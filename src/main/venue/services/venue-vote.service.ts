import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { VoteVenueDto } from '../dto/vote-venue.dto';
import { VenueCacheService } from './venue-cache.service';
import { VenueHelperService } from './venue-helper.service';

@Injectable()
export class VenueVoteService {
  private readonly logger = new Logger(VenueVoteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly venueCacheService: VenueCacheService,
    private readonly helper: VenueHelperService,
  ) {}

  @HandleError('Failed to vote for venue')
  async voteForVenue(
    userId: string,
    venueId: string,
    dto: VoteVenueDto,
  ): Promise<TResponse<any>> {
    // Check if this is a Google venue ID (starts with "google_")
    const isGoogleVenue = venueId.startsWith('google_');
    let venue;

    if (isGoogleVenue) {
      // Extract the actual Google Place ID
      const googlePlaceId = venueId.replace('google_', '');

      // Check if venue already exists in database by googlePlaceId
      venue = await this.prisma.client.venue.findUnique({
        where: { googlePlaceId },
      });

      // If not in database, fetch from cache and create
      if (!venue) {
        const googlePlace = await this.venueCacheService.getCachedPlaceById(
          googlePlaceId,
          dto.latitude,
          dto.longitude,
        );

        if (!googlePlace) {
          throw new AppError(
            404,
            'Venue not found. Please ensure you are near the venue.',
          );
        }

        this.logger.log(
          `Creating new venue from Google Places: ${googlePlace.name}`,
        );

        venue = await this.prisma.client.venue.create({
          data: {
            name: googlePlace.name,
            googlePlaceId: googlePlace.placeId,
            catgegory: googlePlace.category,
            subcategory: googlePlace.subcategory,
            location: googlePlace.location,
            latitude: googlePlace.latitude,
            longitude: googlePlace.longitude,
          },
        });

        this.logger.log(`Created venue with ID: ${venue.id}`);
      }
    } else {
      // Regular database venue lookup
      venue = await this.prisma.client.venue.findUnique({
        where: { id: venueId },
      });
    }

    if (!venue) {
      throw new AppError(404, 'Venue not found');
    }

    // Validate user is near the venue (within 500 meters)
    const MAX_DISTANCE_KM = 0.5;
    const distance = this.helper.calculateDistance(
      dto.latitude,
      dto.longitude,
      venue.latitude,
      venue.longitude,
    );

    if (distance > MAX_DISTANCE_KM) {
      throw new AppError(
        403,
        `You must be within ${MAX_DISTANCE_KM * 1000} meters of the venue to vote. You are ${(distance * 1000).toFixed(0)} meters away.`,
      );
    }

    // Check if user has voted recently (within last 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentVote = await this.prisma.client.votes.findFirst({
      where: {
        userId,
        venueId: venue.id,
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    if (recentVote) {
      const timeLeft = Math.ceil(
        (recentVote.createdAt.getTime() + 60 * 60 * 1000 - Date.now()) /
          1000 /
          60,
      );
      throw new AppError(
        429,
        `You can vote again in ${timeLeft} minutes. Please wait before voting again.`,
      );
    }

    // Create new vote
    const vote = await this.prisma.client.votes.create({
      data: {
        userId,
        venueId: venue.id,
        isOpen: dto.isOpen,
      },
    });

    const venueStatus = await this.helper.getVenueStatus(venue.id);

    return successResponse(
      {
        vote,
        venue: {
          id: venue.id,
          name: venue.name,
          googlePlaceId: venue.googlePlaceId,
        },
        currentStatus: venueStatus,
        message: `Your vote has been recorded. You were ${(distance * 1000).toFixed(0)} meters from the venue.`,
      },
      'Vote recorded successfully',
    );
  }
}
