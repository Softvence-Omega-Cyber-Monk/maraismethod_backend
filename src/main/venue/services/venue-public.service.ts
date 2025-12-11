import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { GooglePlaceResult } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import {
  GetPublicVenuesDto,
  GetSingleVenueDto,
  VenueStatusEnum,
} from '../dto/get-venues.dto';
import { VoteVenueDto } from '../dto/vote-venue.dto';
import { VenueCacheService } from './venue-cache.service';

interface VenueResponse {
  id: string;
  name: string;
  googlePlaceId?: string | null;
  category: string;
  subcategory: string;
  location: string;
  latitude: number;
  longitude: number;
  distance: number;
  status: VenueStatusEnum | null;
  lastVoteUpdate: Date | string | null;
  voteStats: {
    total: number;
    open: number;
    closed: number;
  };
  source: 'database' | 'google';
  description?: string | null;
  imageUrl?: string | null;
  image?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class VenuePublicService {
  private readonly logger = new Logger(VenuePublicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly venueCacheService: VenueCacheService,
  ) {}

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
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

  private async getVenueStatus(
    venueId: string,
  ): Promise<VenueStatusEnum | null> {
    const votes = await this.prisma.client.votes.findMany({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
    });

    if (votes.length === 0) return null;

    const openVotes = votes.filter((v) => v.isOpen).length;
    const closedVotes = votes.filter((v) => !v.isOpen).length;

    return openVotes > closedVotes
      ? VenueStatusEnum.OPEN
      : VenueStatusEnum.CLOSED;
  }

  private async getLastVoteUpdate(venueId: string): Promise<Date | null> {
    const lastVote = await this.prisma.client.votes.findFirst({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
    });

    return lastVote?.createdAt || null;
  }

  private transformGooglePlaceToVenue(
    place: GooglePlaceResult,
    userLatitude: number,
    userLongitude: number,
  ): VenueResponse {
    const distance = this.calculateDistance(
      userLatitude,
      userLongitude,
      place.latitude,
      place.longitude,
    );

    return {
      id: `google_${place.placeId}`,
      name: place.name,
      googlePlaceId: place.placeId,
      category: place.category,
      subcategory: place.subcategory,
      location: place.location,
      latitude: place.latitude,
      longitude: place.longitude,
      distance: parseFloat(distance.toFixed(2)),
      status: null,
      lastVoteUpdate: null,
      voteStats: {
        total: 0,
        open: 0,
        closed: 0,
      },
      source: 'google',
    };
  }

  @HandleError('Failed to get venues')
  async getVenuesByLocation(dto: GetPublicVenuesDto): Promise<TResponse<any>> {
    const { page = 1, limit = 20 } = dto;

    const dbVenues = await this.prisma.client.venue.findMany({
      where: {},
      include: {
        image: true,
        votes: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    const userLatitude = dto.latitude;
    const userLongitude = dto.longitude;

    const googlePlaces = await this.venueCacheService.getCachedPlaces(
      dto.latitude,
      dto.longitude,
    );

    const dbGooglePlaceIds = new Set(
      dbVenues.filter((v) => v.googlePlaceId).map((v) => v.googlePlaceId),
    );

    const processedDbVenues: VenueResponse[] = await Promise.all(
      dbVenues.map(async (venue) => {
        const distance = this.calculateDistance(
          userLatitude,
          userLongitude,
          venue.latitude,
          venue.longitude,
        );

        const venueStatus = await this.getVenueStatus(venue.id);
        const lastVoteUpdate = await this.getLastVoteUpdate(venue.id);

        const openVotes = venue.votes.filter((v) => v.isOpen).length;
        const closedVotes = venue.votes.filter((v) => !v.isOpen).length;
        const totalVotes = venue._count.votes;

        return {
          id: venue.id,
          name: venue.name,
          googlePlaceId: venue.googlePlaceId,
          category: venue.catgegory,
          subcategory: venue.subcategory,
          location: venue.location,
          latitude: venue.latitude,
          longitude: venue.longitude,
          description: venue.description,
          imageUrl: venue.imageUrl,
          image: venue.image,
          distance: parseFloat(distance.toFixed(2)),
          status: venueStatus,
          lastVoteUpdate,
          voteStats: {
            total: totalVotes,
            open: openVotes,
            closed: closedVotes,
          },
          source: 'database' as const,
          createdAt: venue.createdAt,
          updatedAt: venue.updatedAt,
        };
      }),
    );

    const filteredGooglePlaces = googlePlaces.filter(
      (place) => !dbGooglePlaceIds.has(place.placeId),
    );

    const googleVenues: VenueResponse[] = filteredGooglePlaces.map((place) =>
      this.transformGooglePlaceToVenue(place, userLatitude, userLongitude),
    );

    const allVenues = [...processedDbVenues, ...googleVenues];

    allVenues.sort((a, b) => a.distance - b.distance);

    const skip = (page - 1) * limit;
    const paginatedVenues = allVenues.slice(skip, skip + limit);

    this.logger.debug(
      `Returning ${paginatedVenues.length} venues (${processedDbVenues.length} from DB, ${googleVenues.length} from Google)`,
    );

    return successResponse(
      {
        venues: paginatedVenues,
        pagination: {
          total: allVenues.length,
          page,
          limit,
          totalPages: Math.ceil(allVenues.length / limit),
        },
        sources: {
          database: processedDbVenues.length,
          google: googleVenues.length,
        },
      },
      'Venues retrieved successfully',
    );
  }

  @HandleError('Failed to get venue details')
  async getVenueById(
    venueId: string,
    dto: GetSingleVenueDto,
  ): Promise<TResponse<any>> {
    // Check if this is a Google venue ID (starts with "google_")
    const isGoogleVenue = venueId.startsWith('google_');

    if (isGoogleVenue) {
      // Extract the actual Google Place ID
      const googlePlaceId = venueId.replace('google_', '');

      // Try to get from cache
      const googlePlace = await this.venueCacheService.getCachedPlaceById(
        googlePlaceId,
        dto.latitude,
        dto.longitude,
      );

      if (!googlePlace) {
        throw new AppError(404, 'Venue not found');
      }

      const userLatitude = dto.latitude;
      const userLongitude = dto.longitude;

      let distance: number | null = null;
      if (userLatitude && userLongitude) {
        distance = parseFloat(
          this.calculateDistance(
            userLatitude,
            userLongitude,
            googlePlace.latitude,
            googlePlace.longitude,
          ).toFixed(2),
        );
      }

      return successResponse(
        {
          id: venueId,
          name: googlePlace.name,
          googlePlaceId: googlePlace.placeId,
          category: googlePlace.category,
          subcategory: googlePlace.subcategory,
          location: googlePlace.location,
          latitude: googlePlace.latitude,
          longitude: googlePlace.longitude,
          distance,
          status: 'Not Voted',
          lastVoteUpdate: 'No votes yet',
          voteStats: {
            total: 0,
            open: 0,
            closed: 0,
          },
          recentVotes: [],
          source: 'google',
        },
        'Venue details retrieved successfully',
      );
    }

    // Regular database venue lookup
    const venue = await this.prisma.client.venue.findUnique({
      where: { id: venueId },
      include: {
        image: true,
        votes: {
          orderBy: { createdAt: 'desc' },
          take: 50,
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

    const venueStatus = await this.getVenueStatus(venue.id);
    const lastVoteUpdate = await this.getLastVoteUpdate(venue.id);

    const openVotes = venue.votes.filter((v) => v.isOpen).length;
    const closedVotes = venue.votes.filter((v) => !v.isOpen).length;

    const userLatitude = dto.latitude;
    const userLongitude = dto.longitude;

    let distance: number | null = null;
    if (userLatitude && userLongitude) {
      distance = parseFloat(
        this.calculateDistance(
          userLatitude,
          userLongitude,
          venue.latitude,
          venue.longitude,
        ).toFixed(2),
      );
    }

    return successResponse(
      {
        id: venue.id,
        name: venue.name,
        googlePlaceId: venue.googlePlaceId,
        category: venue.catgegory,
        subcategory: venue.subcategory,
        location: venue.location,
        latitude: venue.latitude,
        longitude: venue.longitude,
        description: venue.description,
        imageUrl: venue.imageUrl,
        image: venue.image,
        distance,
        status: venueStatus ?? 'Not Voted',
        lastVoteUpdate: lastVoteUpdate ?? 'No votes yet',
        voteStats: {
          total: venue._count.votes,
          open: openVotes,
          closed: closedVotes,
        },
        recentVotes: venue.votes.slice(0, 10),
        source: 'database',
        createdAt: venue.createdAt,
        updatedAt: venue.updatedAt,
      },
      'Venue details retrieved successfully',
    );
  }

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
    const distance = this.calculateDistance(
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

    const venueStatus = await this.getVenueStatus(venue.id);

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
