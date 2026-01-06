import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { S3Service } from '@/lib/file/services/s3.service';
import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { FileInstance } from '@prisma';
import { VoteVenueDto } from '../dto/vote-venue.dto';
import { VenueCacheService } from './venue-cache.service';
import { VenueHelperService } from './venue-helper.service';

@Injectable()
export class VenueVoteService {
  private readonly logger = new Logger(VenueVoteService.name);
  private readonly MAX_DISTANCE_MILES = 10;
  private readonly VOTE_COOLDOWN_MS = 30 * 1000; // 30 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly venueCacheService: VenueCacheService,
    private readonly helper: VenueHelperService,
    private readonly googleMapsService: GoogleMapsService,
    private readonly s3Service: S3Service,
  ) {}

  @HandleError('Failed to vote for venue')
  async voteForVenue(
    userId: string,
    venueId: string,
    dto: VoteVenueDto,
  ): Promise<TResponse<any>> {
    // Get or create venue
    const venue = await this.getOrCreateVenue(venueId, dto);

    const adminSetting =
      await this.prisma.client.adminSetting.findFirstOrThrow();

    // Validate user proximity
    if (adminSetting.shouldValidateLocation) {
      this.validateUserProximity(dto.latitude, dto.longitude, venue);
    }

    // Check vote cooldown
    if (adminSetting.shouldValidateTime) {
      await this.checkVoteCooldown(userId, venue.id);
    }

    // Create vote
    const vote = await this.prisma.client.votes.create({
      data: {
        userId,
        venueId: venue.id,
        isOpen: dto.isOpen,
      },
    });

    // Get updated venue status
    const venueStatus = await this.helper.getVenueStatus(venue.id);

    const distance = this.helper.calculateDistance(
      dto.latitude,
      dto.longitude,
      venue.latitude,
      venue.longitude,
    );

    return successResponse(
      {
        vote,
        venue: {
          id: venue.id,
          name: venue.name,
          googlePlaceId: venue.googlePlaceId,
          imageUrl: venue.imageUrl,
        },
        currentStatus: venueStatus,
        message: `Your vote has been recorded. You were ${distance.toFixed(2)} miles from the venue.`,
      },
      'Vote recorded successfully',
    );
  }

  private async getOrCreateVenue(
    venueId: string,
    dto: VoteVenueDto,
  ): Promise<any> {
    const isGoogleVenue = venueId.startsWith('google_');

    if (isGoogleVenue) {
      const googlePlaceId = venueId.replace('google_', '');

      // Check if venue already exists in database
      let venue = await this.prisma.client.venue.findUnique({
        where: { googlePlaceId },
      });

      // If not in database, create from Google Places data with image
      if (!venue) {
        venue = await this.createVenueFromGooglePlace(
          googlePlaceId,
          dto.latitude,
          dto.longitude,
        );
      }

      return venue;
    }

    // Regular database venue lookup
    const venue = await this.prisma.client.venue.findUnique({
      where: { id: venueId },
    });

    if (!venue) {
      throw new AppError(404, 'Venue not found');
    }

    return venue;
  }

  /**
   * Create a venue from Google Places data with image download
   */
  private async createVenueFromGooglePlace(
    googlePlaceId: string,
    userLatitude: number,
    userLongitude: number,
  ): Promise<any> {
    // Fetch venue details from cache
    const googlePlace = await this.venueCacheService.getCachedPlaceById(
      googlePlaceId,
      userLatitude,
      userLongitude,
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

    // Try to fetch and store venue image from Google Places
    let imageInstance: FileInstance | null = null;
    try {
      imageInstance = await this.fetchAndStoreGooglePlaceImage(
        googlePlaceId,
        googlePlace.name,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to fetch image for venue ${googlePlace.name}: ${error.message}`,
      );
      // Continue without image
    }

    // Create venue in database
    const venue = await this.prisma.client.venue.create({
      data: {
        name: googlePlace.name,
        googlePlaceId: googlePlace.placeId,
        catgegory: googlePlace.category,
        subcategory: googlePlace.subcategory,
        location: googlePlace.location,
        latitude: googlePlace.latitude,
        longitude: googlePlace.longitude,
        source: 'google',
        operatingHours: {
          createMany: {
            data:
              googlePlace.operatingHours?.map((oh) => ({
                day: oh.day,
                startTime: oh.startTime,
                endTime: oh.endTime,
              })) || [],
          },
        },
        ...(imageInstance && {
          image: {
            connect: { id: imageInstance.id },
          },
          imageUrl: imageInstance.url,
        }),
      },
    });

    this.logger.log(
      `Created venue with ID: ${venue.id}${imageInstance ? ' with image' : ''}`,
    );

    return venue;
  }

  /**
   * Fetch venue photo from Google Places and upload to S3
   */
  private async fetchAndStoreGooglePlaceImage(
    googlePlaceId: string,
    venueName: string,
  ): Promise<FileInstance | null> {
    try {
      // Fetch place photos from Google Places API
      const photos = await this.googleMapsService.getPlacePhotos(
        googlePlaceId,
        1, // Get only the first photo
      );

      if (!photos || photos.length === 0) {
        this.logger.debug(`No photos available for ${venueName}`);
        return null;
      }

      const photoReference = photos[0].photoReference;

      // Download the photo as buffer
      const imageBuffer = await this.googleMapsService.downloadPlacePhoto(
        photoReference,
        800, // Max width - higher quality for venue images
      );

      // Create a file object to upload to S3
      const file: Express.Multer.File = {
        fieldname: 'image',
        originalname: `${googlePlaceId}_${Date.now()}.jpg`,
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: imageBuffer,
        size: imageBuffer.length,
      } as Express.Multer.File;

      // Upload to S3 using existing S3 service
      const uploadedFile = await this.s3Service.uploadFile(file);

      if (!uploadedFile) {
        throw new AppError(400, 'Failed to upload image to S3');
      }

      this.logger.log(
        `Uploaded image for ${venueName} to S3 (ID: ${uploadedFile.id})`,
      );

      return uploadedFile;
    } catch (error) {
      this.logger.error(
        `Error fetching/storing image for ${venueName}: ${error.message}`,
      );
      throw error;
    }
  }

  private validateUserProximity(
    userLat: number,
    userLon: number,
    venue: any,
  ): void {
    const distance = this.helper.calculateDistance(
      userLat,
      userLon,
      venue.latitude,
      venue.longitude,
    );

    if (distance > this.MAX_DISTANCE_MILES) {
      throw new AppError(
        403,
        `You must be within ${this.MAX_DISTANCE_MILES} miles of the venue to vote. You are ${distance.toFixed(2)} miles away.`,
      );
    }
  }

  private async checkVoteCooldown(
    userId: string,
    venueId: string,
  ): Promise<void> {
    const cooldownStart = new Date(Date.now() - this.VOTE_COOLDOWN_MS);

    const recentVote = await this.prisma.client.votes.findFirst({
      where: {
        userId,
        venueId,
        createdAt: {
          gte: cooldownStart,
        },
      },
    });

    if (recentVote) {
      const timeLeft = Math.ceil(
        (recentVote.createdAt.getTime() + this.VOTE_COOLDOWN_MS - Date.now()) /
          1000,
      );

      throw new AppError(
        429,
        `You can vote again in ${timeLeft} seconds. Please wait before voting again.`,
      );
    }
  }
}
