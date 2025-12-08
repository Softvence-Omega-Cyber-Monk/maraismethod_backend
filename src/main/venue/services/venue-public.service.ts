import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class VenuePublicService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get all venues')
  async findAll(): Promise<TResponse<any>> {
    const venues = await this.prisma.client.venue.findMany({
      include: {
        image: true,
        _count: {
          select: {
            votes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return successResponse(venues, 'Venues retrieved successfully');
  }

  @HandleError('Failed to get venue')
  async findOne(id: string): Promise<TResponse<any>> {
    const venue = await this.prisma.client.venue.findUnique({
      where: { id },
      include: {
        image: true,
        votes: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    if (!venue) {
      throw new AppError(404, 'Venue not found');
    }

    return successResponse(venue, 'Venue retrieved successfully');
  }
}
