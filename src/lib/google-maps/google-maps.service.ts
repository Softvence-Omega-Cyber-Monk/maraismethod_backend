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
  subcategory: string;
  types: string[];
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

  async getPlacePhotos(
    placeId: string,
    maxPhotos: number = 5,
  ): Promise<PlacePhoto[]> {
    try {
      const url = `${this.baseUrl}/place/details/json`;
      const params = {
        place_id: placeId,
        fields: 'photos',
        key: this.apiKey,
      };

      const response = await axios.get(url, { params });

      if (response.data.status !== 'OK') {
        this.logger.warn(
          `Google Places API returned status: ${response.data.status}`,
        );
        return [];
      }

      const photos = response.data.result?.photos || [];

      return photos.slice(0, maxPhotos).map((photo: any) => ({
        photoReference: photo.photo_reference,
        height: photo.height,
        width: photo.width,
        htmlAttributions: photo.html_attributions || [],
      }));
    } catch (error) {
      this.logger.error(`Error fetching place photos: ${error.message}`);
      throw error;
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

  private extractSubcategory(types: string[]): string {
    // Skip generic types for subcategory
    const genericTypes = ['point_of_interest', 'establishment'];
    const subcategory = types.find((t) => !genericTypes.includes(t));
    return subcategory?.replace(/_/g, ' ').toUpperCase() || 'GENERAL';
  }
}
