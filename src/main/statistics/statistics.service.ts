import { successResponse, TResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError("Failed to fetch analytics")
  async getAnalytics(): Promise<TResponse<any>> {
    const [totalVenues, categories, totalUsers, activeUsers, totalVotes] =
      await this.prisma.client.$transaction([
        this.prisma.client.venue.count(),
        this.prisma.client.venue.groupBy({
  by: ['catgegory'], // matches the model
  _count: {
    catgegory: true,
  },
  orderBy: {
    _count: {
      catgegory: 'desc',
    },
  },
}),
        this.prisma.client.user.count(),
        this.prisma.client.user.count({
          where: { status: 'ACTIVE' },
        }),
        this.prisma.client.votes.count(),
      ]);

    const avgVotesPerUser = totalUsers > 0 ? totalVotes / totalUsers : 0;

    return successResponse(
      {
        totalVenues,
        categoryCount: categories.length,
        totalUsers,
        activeUsers,
        avgVotesPerUser: parseFloat(avgVotesPerUser.toFixed(1)),
        totalVotes,
      },
      'Analytics fetched successfully',
    );
  }

  @HandleError("Failed to fetch recent venues")
  async getRecentVenues(): Promise<TResponse<any>> {
    const venues = await this.prisma.client.venue.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        catgegory: true,
        location: true,
        imageUrl: true,
        createdAt: true,
      },
    });

    return successResponse(venues, 'Recent venues fetched successfully');
  }

  @HandleError("Failed to fetch recent votes")
  async getRecentVotes(): Promise<TResponse<any>> {
    const votes = await this.prisma.client.votes.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            name: true,
            profilePictureURL: true,
          },
        },
        venue: {
          select: {
            name: true,
          },
        },
      },
    });

    return successResponse(votes, 'Recent votes fetched successfully');
  }
}
