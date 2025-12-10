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

    const [advertisements, total] = await Promise.all([
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

    // Transform with status
    const now = new Date();
    const transformedAds = advertisements.map((ad) => ({
      ...ad,
      isActive: now >= ad.startDate && now <= ad.endDate,
    }));

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
    const transformedAd = {
      ...advertisement,
      isActive: now >= advertisement.startDate && now <= advertisement.endDate,
    };

    return successResponse(transformedAd, 'Advertisement found');
  }
}
