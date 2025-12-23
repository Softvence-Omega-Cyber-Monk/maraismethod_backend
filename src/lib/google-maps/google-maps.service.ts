import { ENVEnum } from '@/common/enum/env.enum';
import { Client } from '@googlemaps/google-maps-services-js';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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
  openTime?: string | null;
  closeTime?: string | null;
}

export interface PlacePhoto {
  photoReference: string;
  height: number;
  width: number;
  htmlAttributions: string[];
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
    type: string = 'establishment',
  ): Promise<GooglePlaceResult[]> {
    try {
      const response = await this.client.placesNearby({
        params: {
          location: { lat: latitude, lng: longitude },
          radius: radiusMeters,
          type,
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK' || !response.data.results) {
        this.logger.warn(
          `Google Places API returned status: ${response.data.status}`,
          response,
        );
        return [];
      }

      const results: GooglePlaceResult[] = [];

      for (const place of response.data.results) {
        // Fetch first photo reference if available
        let imageUrl = '';
        if (place.photos?.length) {
          const photoRef = place.photos[0].photo_reference;
          imageUrl = this.getPlacePhotoUrl(photoRef, 400);
        }

        results.push({
          placeId: place.place_id || '',
          name: place.name || 'Unknown',
          location: place.vicinity || place.formatted_address || '',
          latitude: place.geometry?.location?.lat ?? latitude,
          longitude: place.geometry?.location?.lng ?? longitude,
          imageUrl,
          category: this.extractCategory(place.types || []),
          subcategory: this.extractSubcategory(place.types || []),
          types: place.types || [],
          openNow: place.opening_hours?.open_now ?? null,
        });
      }

      return results;
    } catch (error) {
      this.logger.error(
        'Google Places API error:',
        (error as Error).message ?? error,
        error,
      );
      return [];
    }
  }

  async getPlacePhotos(
    placeId: string,
    maxPhotos: number = 5,
  ): Promise<PlacePhoto[]> {
    try {
      const details = await this.getPlaceDetails(placeId);
      const photos = details.photos || [];

      return photos.slice(0, maxPhotos).map((photo: any) => ({
        photoReference: photo.photo_reference,
        height: photo.height,
        width: photo.width,
        htmlAttributions: photo.html_attributions || [],
      }));
    } catch (error) {
      this.logger.error(`Error fetching place photos: ${error.message}`);
      return [];
    }
  }

  async getPlaceDetails(placeId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/place/details/json`;
      const params = {
        place_id: placeId,
        fields:
          'name,geometry,vicinity,formatted_address,photos,types,opening_hours',
        key: this.apiKey,
      };

      const response = await axios.get(url, { params });

      if (response.data.status !== 'OK') {
        this.logger.warn(
          `Google Places Details API returned status: ${response.data.status}`,
        );
        return null;
      }

      return response.data.result;
    } catch (error) {
      this.logger.error(
        `Error fetching place details for ${placeId}: ${error.message}`,
      );
      return null;
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
      this.logger.error(`Error downloading place photo: ${error.message}`);
      throw error;
    }
  }

  getPlacePhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `${this.baseUrl}/place/photo?photo_reference=${photoReference}&maxwidth=${maxWidth}&key=${this.apiKey}`;
  }

  public extractCategory(types: string[]): string {
    const categoryMapping: Record<string, string> = {
      night_club: 'NIGHT CLUB',
      bar: 'BAR',
      lounge: 'LOUNGE',
      food: 'FOOD',
      restaurant: 'FOOD',
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
      FOOD: ['restaurant', 'cafe', 'fast_food', 'food'],
      'SPORTS BAR': ['sports_bar'],
      'HOTEL BAR': ['hotel_bar'],
    };

    const category = this.extractCategory(types);

    const allowed = subcategoryMapping[category] || [];

    const match = types.find((t) => allowed.includes(t));

    return match?.replace(/_/g, ' ').toUpperCase() || category;
  }
}
