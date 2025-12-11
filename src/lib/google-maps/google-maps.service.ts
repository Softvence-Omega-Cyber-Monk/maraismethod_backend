import { ENVEnum } from '@/common/enum/env.enum';
import { Client } from '@googlemaps/google-maps-services-js';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GooglePlaceResult {
  placeId: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  category: string;
  subcategory: string;
  types: string[];
}

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);
  private client: Client;
  private apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({});
    this.apiKey = this.configService.getOrThrow<string>(
      ENVEnum.GOOGLE_MAPS_API_KEY,
    );
  }

  // -----------------------
  // Accessors
  // -----------------------
  getClient(): Client {
    return this.client;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  // -----------------------
  // Google Maps helpers
  // -----------------------
  /**
   * Validate coordinates by performing a reverse geocode and ensuring we get at least one result.
   * Returns true when the API returns OK and at least one result.
   */
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
      );
      return false;
    }
  }

  // -----------------------
  // Google Places helpers
  // -----------------------
  /**
   * Search for nearby venues using Google Places API
   * @param latitude User's latitude
   * @param longitude User's longitude
   * @param radiusMeters Search radius in meters (default: 5000)
   * @param type Place type to search for (default: establishment)
   */
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
        );
        return [];
      }

      return response.data.results.map((place) => ({
        placeId: place.place_id || '',
        name: place.name || 'Unknown',
        location: place.vicinity || place.formatted_address || '',
        latitude: place.geometry?.location?.lat ?? latitude,
        longitude: place.geometry?.location?.lng ?? longitude,
        category: this.extractCategory(place.types || []),
        subcategory: this.extractSubcategory(place.types || []),
        types: place.types || [],
      }));
    } catch (error) {
      this.logger.error(
        'Google Places API error:',
        (error as Error).message ?? error,
      );
      return [];
    }
  }

  // -----------------------
  // Type extraction helpers
  // -----------------------
  /**
   * Extract primary category from Google Places types
   */
  private extractCategory(types: string[]): string {
    // Priority order for category extraction
    const categoryPriority = [
      'restaurant',
      'cafe',
      'bar',
      'food',
      'store',
      'shopping_mall',
      'lodging',
      'point_of_interest',
      'establishment',
    ];

    for (const cat of categoryPriority) {
      if (types.includes(cat)) {
        return cat.replace(/_/g, ' ').toUpperCase();
      }
    }

    return types[0]?.replace(/_/g, ' ').toUpperCase() || 'OTHER';
  }

  /**
   * Extract subcategory from Google Places types
   */
  private extractSubcategory(types: string[]): string {
    // Skip generic types for subcategory
    const genericTypes = ['point_of_interest', 'establishment'];
    const subcategory = types.find((t) => !genericTypes.includes(t));
    return subcategory?.replace(/_/g, ' ').toUpperCase() || 'GENERAL';
  }
}
