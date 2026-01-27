import { calculateDistanceInMiles, toRad } from '@/common/utils/distance.util';
import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma';
import { DateTime } from 'luxon';
import { GetAdsDto } from '../dto/get-ads.dto';
import { AdsService } from './ads.service';

@Injectable()
export class AdsPublicService {
  private logger = new Logger(AdsPublicService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMapsService: GoogleMapsService,
    private readonly adsService: AdsService,
  ) {}

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in miles
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    return calculateDistanceInMiles(lat1, lon1, lat2, lon2);
  }

  private toRad(degrees: number): number {
    return toRad(degrees);
  }

  /**
   * Check if an advertisement is currently active (within date range)
   * Uses user's timezone for accurate date checking
   */
  private async isAdActive(
    ad: { startDate: Date; endDate: Date },
    userLatitude?: number,
    userLongitude?: number,
  ): Promise<boolean> {
    let now: DateTime = DateTime.now();

    // If user location is provided, get user's timezone
    if (userLatitude && userLongitude) {
      try {
        const timezone = await this.googleMapsService.getTimezone(
          userLatitude,
          userLongitude,
        );
        now = DateTime.now().setZone(timezone).toUTC();
      } catch (error) {
        this.logger.error(
          `Failed to get timezone for user location (${userLatitude}, ${userLongitude}): ${error}`,
        );
        // Fallback to UTC if timezone lookup fails
        now = DateTime.now().setZone('UTC').toUTC();
      }
    }

    const adStart = DateTime.fromJSDate(ad.startDate).setZone(now.zone);
    const adEnd = DateTime.fromJSDate(ad.endDate).setZone(now.zone);

    return now >= adStart && now <= adEnd;
  }

  @HandleError('Failed to get advertisements')
  async getAdsByLocation(
    userLatitude: number,
    userLongitude: number,
    dto: GetAdsDto,
  ): Promise<TResponse<any>> {
    const { search, page = 1, limit = 10 } = dto;

    // Build where clause
    const where: Prisma.AdvertisementWhereInput = {};

    this.logger.log(
      `Getting advertisements for page ${page} and limit ${limit}`,
      userLatitude,
      userLongitude,
    );

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get all advertisements
    const advertisements = await this.prisma.client.advertisement.findMany({
      where,
      include: {
        file: true,
        advertisementAnalytics: true,
      },
    });

    // Filter by distance + process
    const processedAds = await Promise.all(
      advertisements.map(async (ad: any) => {
        const distance = this.calculateDistance(
          userLatitude,
          userLongitude,
          ad.latitude,
          ad.longitude,
        );

        return {
          id: ad.id,
          title: ad.title,
          description: ad.description,
          location: ad.location,
          latitude: ad.latitude,
          longitude: ad.longitude,
          adShowRangeInMiles: ad.adShowRangeInMiles,
          startDate: ad.startDate,
          endDate: ad.endDate,
          fileUrl: ad.fileUrl,
          file: ad.file,
          distance: parseFloat(distance.toFixed(2)),
          isActive: await this.isAdActive(ad, userLatitude, userLongitude),
          analytics: ad.advertisementAnalytics,
          createdAt: ad.createdAt,
          updatedAt: ad.updatedAt,
        };
      }),
    );

    // Filter: within radius
    const filteredAds = processedAds.filter(
      (ad: { distance: number; adShowRangeInMiles: number }) =>
        ad.distance <= ad.adShowRangeInMiles + 0.2,
    );

    // Sort by distance
    const sortedAds = filteredAds.sort((a, b) => a.distance - b.distance);

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedAds = sortedAds.slice(skip, skip + limit);

    // Increment impressions in background for the ads that are actually shown
    if (paginatedAds.length > 0) {
      const adIds = paginatedAds.map((ad) => ad.id);
      // We don't await this to keep the response fast
      this.adsService.incrementImpressions(adIds);
    }

    return successResponse(
      {
        advertisements: paginatedAds,
        pagination: {
          total: sortedAds.length,
          page,
          limit,
          totalPages: Math.ceil(sortedAds.length / limit),
        },
      },
      'Advertisements retrieved successfully',
    );
  }

  @HandleError('Failed to get advertisement details')
  async getAdById(
    adId: string,
    userLatitude?: number,
    userLongitude?: number,
  ): Promise<TResponse<any>> {
    const advertisement = await this.prisma.client.advertisement.findUnique({
      where: { id: adId },
      include: {
        file: true,
        advertisementAnalytics: true,
      },
    });

    if (!advertisement) {
      throw new AppError(404, 'Advertisement not found');
    }

    // Increment clicks (since retrieving details means the user clicked the ad)
    if (advertisement.advertisementAnalytics) {
      await this.adsService.incrementClick(advertisement.id);
    }

    let distance: number | null = null;
    if (userLatitude && userLongitude) {
      distance = parseFloat(
        this.calculateDistance(
          userLatitude,
          userLongitude,
          advertisement.latitude,
          advertisement.longitude,
        ).toFixed(2),
      );
    }

    return successResponse(
      {
        id: advertisement.id,
        title: advertisement.title,
        description: advertisement.description,
        location: advertisement.location,
        latitude: advertisement.latitude,
        longitude: advertisement.longitude,
        adShowRangeInMiles: advertisement.adShowRangeInMiles,
        startDate: advertisement.startDate,
        endDate: advertisement.endDate,
        fileUrl: advertisement.fileUrl,
        file: advertisement.file,
        distance,
        isActive: this.isAdActive(advertisement),
        analytics: {
          impressions: advertisement.advertisementAnalytics?.impressions ?? 0,
          clicks: (advertisement.advertisementAnalytics?.clicks ?? 0) + 1,
        },
        createdAt: advertisement.createdAt,
        updatedAt: advertisement.updatedAt,
      },
      'Advertisement details retrieved successfully',
    );
  }

  @HandleError('Failed to record click')
  async recordClick(adId: string): Promise<TResponse<any>> {
    const advertisement = await this.prisma.client.advertisement.findUnique({
      where: { id: adId },
      include: {
        advertisementAnalytics: true,
      },
    });

    if (!advertisement) {
      throw new AppError(404, 'Advertisement not found');
    }

    if (!advertisement.advertisementAnalytics) {
      throw new AppError(404, 'Advertisement analytics not found');
    }

    // Increment clicks
    const updatedAnalytics =
      await this.prisma.client.advertisementAnalytics.update({
        where: { id: advertisement.advertisementAnalytics.id },
        data: {
          clicks: { increment: 1 },
        },
      });

    return successResponse(
      {
        clicks: updatedAnalytics.clicks,
        impressions: updatedAnalytics.impressions,
      },
      'Click recorded successfully',
    );
  }
}
