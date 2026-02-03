import { ENVEnum } from '@/common/enum/env.enum';
import { Client } from '@googlemaps/google-maps-services-js';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DateTime } from 'luxon';

export interface GooglePlaceResult {
  placeId: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  category: string;
  imageUrl: string;
  subcategory: string;
  types: string[];
  openNow?: boolean | null;
  openingHours?: any;
  operatingHours?: {
    day: number;
    label: string;
    startTime: string | null;
    endTime: string | null;
  }[];
}

export interface PlacePhoto {
  photoReference: string;
  height: number;
  width: number;
  htmlAttributions: string[];
}

export interface OpeningHoursPeriod {
  open?: { day: number; time?: string };
  close?: { day: number; time?: string };
}

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);
  private client: Client;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://maps.googleapis.com/maps/api';

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({});
    this.apiKey = this.configService.getOrThrow<string>(
      ENVEnum.GOOGLE_MAPS_API_KEY,
    );
  }

  getClient(): Client {
    return this.client;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  async validateCoordinates(
    latitude: number,
    longitude: number,
  ): Promise<boolean> {
    try {
      const response = await this.client.reverseGeocode({
        params: {
          latlng: { lat: latitude, lng: longitude },
          key: this.apiKey,
        },
      });

      const ok =
        response.data.status === 'OK' && response.data.results?.length > 0;
      if (!ok) {
        this.logger.warn(
          `Reverse geocode returned status=${response.data.status} for (${latitude}, ${longitude})`,
        );
      }
      return ok;
    } catch (error) {
      this.logger.error(
        `Google Maps reverseGeocode error for (${latitude}, ${longitude}):`,
        (error as Error).message ?? error,
        error,
      );
      return false;
    }
  }

  async searchNearbyVenues(
    latitude: number,
    longitude: number,
    radiusMeters: number = 5000,
    search?: string,
    enrichWithDetails: boolean = true,
  ): Promise<GooglePlaceResult[]> {
    try {
      const baseKeywords = 'night club bar lounge sports bar hotel bar';
      const keyword = search ? `${search} ${baseKeywords}` : baseKeywords;

      if (search && search.trim() !== '') {
        const response = await this.client.placeAutocomplete({
          params: {
            input: search,
            key: this.apiKey,
          },
        });

        if (!response.data.predictions) return [];

        const results: GooglePlaceResult[] = [];

        // Fetch details for predictions to get coordinates, types, etc.
        // Limiting to 10 for performance
        await Promise.all(
          response.data.predictions.slice(0, 20).map(async (prediction) => {
            try {
              const details = await this.getPlaceDetails(prediction.place_id);
              if (details) {
                // Skip if it's a political boundary or other non-venue
                // if (this.shouldSkipPlace(details.types || [])) return;

                results.push({
                  placeId: prediction.place_id,
                  name: details.name,
                  location: details.formatted_address || details.vicinity || '',
                  latitude: details.geometry?.location?.lat ?? 0,
                  longitude: details.geometry?.location?.lng ?? 0,
                  category: this.extractCategory(details.types || []),
                  subcategory: this.extractSubcategory(details.types || []),
                  types: details.types || [],
                  imageUrl: details.photos?.[0]
                    ? this.getPlacePhotoUrl(details.photos[0].photo_reference)
                    : '',
                  openNow: details.opening_hours?.open_now ?? null,
                  openingHours: details.opening_hours,
                  operatingHours: this.extractAllWeekHours(
                    details.opening_hours?.periods,
                  ),
                });
              }
            } catch (error) {
              this.logger.warn(
                `Failed to fetch details for ${prediction.place_id}: ${error.message}`,
              );
            }
          }),
        );

        return results;
      }

      const response = await this.client.placesNearby({
        params: {
          location: { lat: latitude, lng: longitude },
          radius: radiusMeters,
          keyword,
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK' || !response.data.results) {
        this.logger.warn(
          `Google Places API returned status: ${response.data.status}`,
        );
        return [];
      }

      const results = this.mapPlaces(
        response.data.results,
        latitude,
        longitude,
      );

      if (enrichWithDetails) {
        await this.enrichPlacesWithDetails(results);
      }

      return results;
    } catch (error) {
      this.logger.error(
        'Google Places API error:',
        (error as Error).message ?? error,
      );
      return [];
    }
  }

  private mapPlaces(
    places: any[],
    fallbackLat?: number,
    fallbackLng?: number,
  ): GooglePlaceResult[] {
    const results: GooglePlaceResult[] = [];

    for (const place of places) {
      // Skip irrelevant places (political boundaries etc.)
      // if (this.shouldSkipPlace(place.types || [])) continue;

      // Handle photo
      let imageUrl = '';
      if (place.photos?.length) {
        const photoRef = place.photos[0].photo_reference;
        imageUrl = this.getPlacePhotoUrl(photoRef, 400);
      }

      results.push({
        placeId: place.place_id || '',
        name: place.name || 'Unknown',
        location: place.vicinity || place.formatted_address || '',
        latitude: place.geometry?.location?.lat ?? fallbackLat ?? 0,
        longitude: place.geometry?.location?.lng ?? fallbackLng ?? 0,
        imageUrl,
        category: this.extractCategory(place.types || []),
        subcategory: this.extractSubcategory(place.types || []),
        types: place.types || [],
        openNow: place.opening_hours?.open_now ?? null,
        openingHours: place.opening_hours,
        operatingHours: this.extractAllWeekHours(place?.opening_hours?.periods),
      });
    }

    return results;
  }

  /**
   * Check if place type should be skipped (non-venues)
   */
  private shouldSkipPlace(types: string[]): boolean {
    const skipTypes = [
      'neighborhood',
      'political',
      'locality',
      'sublocality',
      'administrative_area_level_1',
      'administrative_area_level_2',
      'administrative_area_level_3',
      'country',
      'postal_code',
      'route',
      'street_address',
    ];

    // If place only has skip types, skip it
    return types.every((type) => skipTypes.includes(type));
  }

  /**
   * Enrich places with full details (opening hours) - batch processing
   */
  private async enrichPlacesWithDetails(
    places: GooglePlaceResult[],
  ): Promise<void> {
    const placesToEnrich = places.filter(
      (p) => !p.operatingHours || p.operatingHours.length === 0,
    );

    if (placesToEnrich.length === 0) return;

    this.logger.log(
      `Enriching ${placesToEnrich.length} places with detailed hours...`,
    );

    // Process in batches to avoid rate limits (max 10 concurrent)
    const batchSize = 10;
    const batches: GooglePlaceResult[][] = [];

    for (let i = 0; i < placesToEnrich.length; i += batchSize) {
      batches.push(placesToEnrich.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (place) => {
          try {
            const details = await this.getPlaceDetails(place.placeId);
            this.logger.log(
              `Enriched place ${place.placeId}`,
              JSON.stringify(details),
            );

            if (details?.opening_hours) {
              // Update opening hours
              place.openingHours = details.opening_hours;
              place.openNow = details.opening_hours.open_now ?? null;

              // Extract all hours
              place.operatingHours = this.extractAllWeekHours(
                details.opening_hours.periods,
              );
            }
          } catch (error) {
            this.logger.warn(
              `Failed to enrich place ${place.placeId}: ${(error as Error).message}`,
            );
          }
        }),
      );

      // Small delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.logger.log(`Successfully enriched ${placesToEnrich.length} places`);
  }

  async getPlacePhotos(
    placeId: string,
    maxPhotos: number = 5,
  ): Promise<PlacePhoto[]> {
    try {
      const details = await this.getPlaceDetails(placeId);
      const photos = details?.photos || [];

      return photos.slice(0, maxPhotos).map((photo: any) => ({
        photoReference: photo.photo_reference,
        height: photo.height,
        width: photo.width,
        htmlAttributions: photo.html_attributions || [],
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching place photos: ${(error as Error).message}`,
      );
      return [];
    }
  }

  async getPlaceDetails(placeId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/place/details/json`;
      const params = {
        place_id: placeId,
        fields:
          'place_id,name,geometry,vicinity,formatted_address,photos,types,opening_hours,business_status,rating,user_ratings_total,website,formatted_phone_number',
        key: this.apiKey,
      };

      const response = await axios.get(url, { params });

      if (response.data.status !== 'OK') {
        this.logger.warn(
          `Google Places Details API returned status: ${response.data.status} for place ${placeId}`,
        );
        return null;
      }

      return response.data.result;
    } catch (error) {
      this.logger.error(
        `Error fetching place details for ${placeId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async getTimezone(latitude: number, longitude: number): Promise<string> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const url = `${this.baseUrl}/timezone/json`;
      const params = {
        location: `${latitude},${longitude}`,
        timestamp,
        key: this.apiKey,
      };

      const response = await axios.get(url, { params });

      if (response.data.status === 'OK') {
        return response.data.timeZoneId; // e.g., "America/New_York"
      }
      return 'UTC';
    } catch (error) {
      this.logger.error(
        `Error fetching timezone for (${latitude}, ${longitude}): ${(error as Error).message}`,
      );
      return 'UTC';
    }
  }

  async downloadPlacePhoto(
    photoReference: string,
    maxWidth: number = 400,
  ): Promise<Buffer> {
    try {
      const url = `${this.baseUrl}/place/photo`;
      const params = {
        photo_reference: photoReference,
        maxwidth: maxWidth,
        key: this.apiKey,
      };

      const response = await axios.get(url, {
        params,
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(
        `Error downloading place photo: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  getPlacePhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `${this.baseUrl}/place/photo?photo_reference=${photoReference}&maxwidth=${maxWidth}&key=${this.apiKey}`;
  }

  /**
   * Extract all opening hours from Google's periods array
   */
  extractAllWeekHours(periods?: OpeningHoursPeriod[]): {
    day: number;
    label: string;
    startTime: string | null;
    endTime: string | null;
  }[] {
    if (!periods || periods.length === 0) {
      return [];
    }

    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    const results: {
      day: number;
      label: string;
      startTime: string | null;
      endTime: string | null;
    }[] = [];

    for (const period of periods) {
      if (period.open) {
        results.push({
          day: period.open.day,
          label: dayNames[period.open.day],
          startTime: period.open.time
            ? this.formatGoogleTime(period.open.time)
            : null,
          endTime: period.close?.time
            ? this.formatGoogleTime(period.close.time)
            : null,
        });
      }
    }

    return results;
  }

  /**
   * Extract opening hours for today from Google's periods array
   */
  extractTodayHours(
    periods?: OpeningHoursPeriod[],
    timezone: string = 'UTC',
  ): {
    openTime: string | null;
    closeTime: string | null;
  } {
    if (!periods || periods.length === 0) {
      return { openTime: null, closeTime: null };
    }

    const now = DateTime.now().setZone(timezone);
    const today = now.weekday === 7 ? 0 : now.weekday; // Google: 0 (Sun) to 6 (Sat). Luxon: 1 (Mon) to 7 (Sun).

    const todayPeriod = periods.find((p) => p.open?.day === today);

    if (!todayPeriod) {
      return { openTime: null, closeTime: null };
    }

    const openTime = todayPeriod.open?.time
      ? this.formatGoogleTime(todayPeriod.open.time)
      : null;
    const closeTime = todayPeriod.close?.time
      ? this.formatGoogleTime(todayPeriod.close.time)
      : null;

    return { openTime, closeTime };
  }

  /**
   * Format Google's time string (e.g., "0900") to HH:mm format (e.g., "09:00")
   */
  private formatGoogleTime(time: string): string {
    if (!time || time.length !== 4) return time;
    return `${time.slice(0, 2)}:${time.slice(2)}`;
  }

  public extractCategory(types: string[]): string {
    const categoryMapping: Record<string, string> = {
      night_club: 'NIGHT CLUB',
      bar: 'BAR',
      lounge: 'LOUNGE',
      sports_bar: 'SPORTS BAR',
      hotel_bar: 'HOTEL BAR',
    };

    for (const t of types) {
      if (categoryMapping[t]) {
        return categoryMapping[t];
      }
    }

    return types[0]?.replace(/_/g, ' ').toUpperCase() || 'OTHER';
  }

  public extractSubcategory(types: string[]): string {
    const subcategoryMapping: Record<string, string[]> = {
      'NIGHT CLUB': ['night_club', 'club', 'discotheque'],
      BAR: ['bar', 'pub', 'wine_bar'],
      LOUNGE: ['lounge', 'hookah_lounge', 'rooftop_lounge'],
      'SPORTS BAR': ['sports_bar'],
      'HOTEL BAR': ['hotel_bar'],
    };

    const category = this.extractCategory(types);
    const allowed = subcategoryMapping[category] || [];
    const match = types.find((t) => allowed.includes(t));

    return match?.replace(/_/g, ' ').toUpperCase() || category;
  }
}
