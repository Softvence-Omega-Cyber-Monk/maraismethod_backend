import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma';
import { GetAdsDto } from '../dto/get-ads.dto';

@Injectable()
export class GetAdsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate CTR (Click-Through Rate) as a percentage
   * CTR = (clicks / impressions) * 100
   */
  private calculateCTR(clicks: number, impressions: number): number {
    if (impressions === 0) return 0;
    return parseFloat(((clicks / impressions) * 100).toFixed(2));
  }

  @HandleError('Failed to get advertisements')
  async getAllAds(dto: GetAdsDto) {
    const page = dto.page && dto.page > 0 ? dto.page : 1;
    const limit = dto.limit && dto.limit > 0 ? dto.limit : 10;
    const skip = (page - 1) * limit;

    const adWhere: Prisma.AdvertisementWhereInput = {};

    if (dto.search) {
      const q = dto.search;
      adWhere.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Filter by active status if specified
    if (dto.isActive !== undefined) {
      const now = new Date();
      if (dto.isActive) {
        adWhere.startDate = { lte: now };
        adWhere.endDate = { gte: now };
      } else {
        adWhere.OR = [{ startDate: { gt: now } }, { endDate: { lt: now } }];
      }
    }

    const [advertisements, total] = await this.prisma.client.$transaction([
      this.prisma.client.advertisement.findMany({
        where: adWhere,
        include: {
          file: true,
          advertisementAnalytics: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.advertisement.count({ where: adWhere }),
    ]);

    // Transform with status and CTR
    const now = new Date();
    const transformedAds = advertisements.map((ad) => {
      const impressions = ad.advertisementAnalytics?.impressions ?? 0;
      const clicks = ad.advertisementAnalytics?.clicks ?? 0;
      const ctr = this.calculateCTR(clicks, impressions);

      return {
        ...ad,
        contentType: ad.file?.fileType || null,
        isActive: now >= ad.startDate && now <= ad.endDate,
        analytics: {
          impressions,
          clicks,
          ctr,
        },
      };
    });

    return successPaginatedResponse(
      transformedAds,
      { total, page, limit },
      'Advertisements found',
    );
  }

  @HandleError('Failed to get advertisement')
  async getSingleAd(id: string) {
    const advertisement =
      await this.prisma.client.advertisement.findUniqueOrThrow({
        where: { id },
        include: {
          file: true,
          advertisementAnalytics: true,
        },
      });

    const now = new Date();
    const impressions = advertisement.advertisementAnalytics?.impressions ?? 0;
    const clicks = advertisement.advertisementAnalytics?.clicks ?? 0;
    const ctr = this.calculateCTR(clicks, impressions);

    const transformedAd = {
      ...advertisement,
      contentType: advertisement.file?.fileType || null,
      isActive: now >= advertisement.startDate && now <= advertisement.endDate,
      analytics: {
        impressions,
        clicks,
        ctr,
      },
    };

    return successResponse(transformedAd, 'Advertisement found');
  }
}
