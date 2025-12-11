import {
  GoogleMapsService,
  GooglePlaceResult,
} from '@/lib/google-maps/google-maps.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';

// Cache TTL in milliseconds (15 minutes)
const CACHE_TTL_MS = 15 * 60 * 1000;

// Grid size for location-based caching (0.01 degrees ≈ 1.1km)
const GRID_SIZE = 0.01;

@Injectable()
export class VenueCacheService {
  private readonly logger = new Logger(VenueCacheService.name);

  constructor(
    @Inject(CACHE_MANAGER)
    private cacheManager: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any, ttl: number) => Promise<void>;
      del: (key: string) => Promise<void>;
    },
    private readonly googlePlacesService: GoogleMapsService,
  ) {}

  /**
   * Get cache key based on location grid
   * Using grid-based caching to reuse results for nearby requests
   */
  private getCacheKey(latitude: number, longitude: number): string {
    const gridLat = Math.floor(latitude / GRID_SIZE) * GRID_SIZE;
    const gridLng = Math.floor(longitude / GRID_SIZE) * GRID_SIZE;
    return `places:${gridLat.toFixed(4)}:${gridLng.toFixed(4)}`;
  }

  /**
   * Get Google Places results with caching
   * @param latitude User's latitude
   * @param longitude User's longitude
   * @param radiusMeters Search radius in meters
   */
  async getCachedPlaces(
    latitude: number,
    longitude: number,
    radiusMeters: number = 5000,
  ): Promise<GooglePlaceResult[]> {
    const cacheKey = this.getCacheKey(latitude, longitude);

    // Try to get from cache
    const cached = (await this.cacheManager.get(cacheKey)) as
      | GooglePlaceResult[]
      | undefined;
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    this.logger.debug(
      `Cache miss for ${cacheKey}, fetching from Google Places`,
    );

    // Fetch from Google Places API
    const places = await this.googlePlacesService.searchNearbyVenues(
      latitude,
      longitude,
      radiusMeters,
    );

    // Store in cache
    await this.cacheManager.set(cacheKey, places, CACHE_TTL_MS);

    return places;
  }

  /**
   * Invalidate cache for a specific location
   */
  async invalidateCache(latitude: number, longitude: number): Promise<void> {
    const cacheKey = this.getCacheKey(latitude, longitude);
    await this.cacheManager.del(cacheKey);
    this.logger.debug(`Cache invalidated for ${cacheKey}`);
  }
}
