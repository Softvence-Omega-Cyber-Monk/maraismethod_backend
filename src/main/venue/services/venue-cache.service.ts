import {
  GoogleMapsService,
  GooglePlaceResult,
} from '@/lib/google-maps/google-maps.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';

// Cache TTL in milliseconds (7 days)
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Grid size for location-based caching (0.01 degrees ≈ 0.68 miles)
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
   * Get cache key based on location grid and search query
   * Using grid-based caching to reuse results for nearby requests
   */
  private getCacheKey(
    latitude: number,
    longitude: number,
    search?: string,
  ): string {
    const gridLat = Math.floor(latitude / GRID_SIZE) * GRID_SIZE;
    const gridLng = Math.floor(longitude / GRID_SIZE) * GRID_SIZE;
    let key = `places:${gridLat.toFixed(4)}:${gridLng.toFixed(4)}`;
    if (search) {
      key += `:${search.toLowerCase().trim()}`;
    }
    return key;
  }

  /**
   * Get cache key for a specific place
   */
  private getPlaceCacheKey(placeId: string): string {
    return `place:${placeId}`;
  }

  /**
   * Get Google Places results with caching
   * @param latitude User's latitude
   * @param longitude User's longitude
   * @param radiusMeters Search radius in meters
   * @param search Optional search query
   */
  async getCachedPlaces(
    latitude: number,
    longitude: number,
    radiusMeters: number = 5000,
    search?: string,
  ): Promise<GooglePlaceResult[]> {
    const cacheKey = this.getCacheKey(latitude, longitude, search);

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
      search,
    );

    // this.logger.debug(
    //   `Fetched ${places.length} places from Google Places for ${cacheKey}`,
    //   places,
    // );

    // Store in cache (both the list and individual places)
    await this.cacheManager.set(cacheKey, places, CACHE_TTL_MS);

    // Cache individual places for quick lookup by placeId
    for (const place of places) {
      const placeCacheKey = this.getPlaceCacheKey(place.placeId);
      await this.cacheManager.set(placeCacheKey, place, CACHE_TTL_MS);
    }

    return places;
  }

  /**
   * Get a single Google Place by placeId with caching
   * @param placeId Google Place ID
   * @param userLatitude Optional user latitude to search nearby if not cached
   * @param userLongitude Optional user longitude to search nearby if not cached
   */
  async getCachedPlaceById(
    placeId: string,
    userLatitude?: number,
    userLongitude?: number,
  ): Promise<GooglePlaceResult | null> {
    const cacheKey = this.getPlaceCacheKey(placeId);

    // Try to get from individual place cache
    const cached = (await this.cacheManager.get(cacheKey)) as
      | GooglePlaceResult
      | undefined;

    if (cached) {
      this.logger.debug(`Cache hit for place ${placeId}`);
      return cached;
    }

    // If not in cache and we have user location, search nearby venues
    if (userLatitude !== undefined && userLongitude !== undefined) {
      this.logger.debug(
        `Cache miss for place ${placeId}, searching nearby venues`,
      );

      // This will fetch and cache all nearby places
      const places = await this.getCachedPlaces(userLatitude, userLongitude);

      // Find the specific place
      const place = places.find((p) => p.placeId === placeId);

      if (place) {
        this.logger.debug(`Found place ${placeId} in nearby search results`);
        return place;
      }
    }

    this.logger.debug(`Place ${placeId} not found in cache or nearby search`);
    return null;
  }

  /**
   * Invalidate cache for a specific location
   */
  async invalidateCache(latitude: number, longitude: number): Promise<void> {
    const cacheKey = this.getCacheKey(latitude, longitude);
    await this.cacheManager.del(cacheKey);
    this.logger.debug(`Cache invalidated for ${cacheKey}`);
  }

  /**
   * Invalidate cache for a specific place
   */
  async invalidatePlaceCache(placeId: string): Promise<void> {
    const cacheKey = this.getPlaceCacheKey(placeId);
    await this.cacheManager.del(cacheKey);
    this.logger.debug(`Cache invalidated for place ${placeId}`);
  }
}
