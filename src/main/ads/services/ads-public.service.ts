import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { GetAdsDto } from '../dto/get-ads.dto';

@Injectable()
export class AdsPublicService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if an advertisement is currently active (within date range)
   */
  private isAdActive(ad: { startDate: Date; endDate: Date }): boolean {
    const now = new Date();
    return now >= ad.startDate && now <= ad.endDate;
  }

  @HandleError('Failed to get advertisements')
  async getAdsByLocation(
    userLatitude: number,
    userLongitude: number,
    dto: GetAdsDto,
  ): Promise<TResponse<any>> {
    const { search, isActive, page = 1, limit = 10 } = dto;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by active status if specified
    if (isActive !== undefined) {
      const now = new Date();
      if (isActive) {
        where.startDate = { lte: now };
        where.endDate = { gte: now };
      } else {
        where.OR = [{ startDate: { gt: now } }, { endDate: { lt: now } }];
      }
    }

    // Get all advertisements
    const advertisements = await this.prisma.client.advertisement.findMany({
      where,
      include: {
        file: true,
        advertisementAnalytics: true,
      },
    });

    // Filter by distance and process
    const processedAds = advertisements
      .map((ad) => {
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
          adShowRangeInKm: ad.adShowRangeInKm,
          startDate: ad.startDate,
          endDate: ad.endDate,
          fileUrl: ad.fileUrl,
          file: ad.file,
          distance: parseFloat(distance.toFixed(2)),
          isActive: this.isAdActive(ad),
          analytics: ad.advertisementAnalytics,
          createdAt: ad.createdAt,
          updatedAt: ad.updatedAt,
        };
      })
      // Filter: only show ads where user is within the ad's range
      .filter((ad) => ad.distance <= ad.adShowRangeInKm)
      // Sort by distance (closest first)
      .sort((a, b) => a.distance - b.distance);

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedAds = processedAds.slice(skip, skip + limit);

    return successResponse(
      {
        advertisements: paginatedAds,
        pagination: {
          total: processedAds.length,
          page,
          limit,
          totalPages: Math.ceil(processedAds.length / limit),
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

    // Increment impressions
    if (advertisement.advertisementAnalytics) {
      await this.prisma.client.advertisementAnalytics.update({
        where: { id: advertisement.advertisementAnalytics.id },
        data: {
          impressions: { increment: 1 },
        },
      });
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
        adShowRangeInKm: advertisement.adShowRangeInKm,
        startDate: advertisement.startDate,
        endDate: advertisement.endDate,
        fileUrl: advertisement.fileUrl,
        file: advertisement.file,
        distance,
        isActive: this.isAdActive(advertisement),
        analytics: {
          impressions:
            (advertisement.advertisementAnalytics?.impressions ?? 0) + 1,
          clicks: advertisement.advertisementAnalytics?.clicks ?? 0,
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
