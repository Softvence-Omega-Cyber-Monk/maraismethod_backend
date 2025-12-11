import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { GetVenuesDto, VenueStatusEnum } from '../dto/get-venues.dto';
import { VoteVenueDto } from '../dto/vote-venue.dto';
import { VenueCacheService } from './venue-cache.service';
import { GooglePlaceResult } from '@/lib/google-maps/google-maps.service';

// Common venue response interface for both DB and Google Places venues
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
   * Determine venue status based on votes
   * Returns 'OPEN' if majority voted open, 'CLOSED' if majority voted closed, null if no votes
   */
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

  /**
   * Get last vote update time for a venue
   */
  private async getLastVoteUpdate(venueId: string): Promise<Date | null> {
    const lastVote = await this.prisma.client.votes.findFirst({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
    });

    return lastVote?.createdAt || null;
  }

  /**
   * Transform Google Place result to venue response format
   */
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
      id: `google_${place.placeId}`, // Temporary ID for Google venues
      name: place.name,
      googlePlaceId: place.placeId,
      category: place.category,
      subcategory: place.subcategory,
      location: place.location,
      latitude: place.latitude,
      longitude: place.longitude,
      distance: parseFloat(distance.toFixed(2)),
      status: null, // No votes yet for Google-only venues
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
  async getVenuesByLocation(
    userLatitude: number,
    userLongitude: number,
    dto: GetVenuesDto,
  ): Promise<TResponse<any>> {
    const {
      search,
      category,
      subcategory,
      status,
      boatCount,
      page = 1,
      limit = 10,
    } = dto;

    // Build where clause for DB venues
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.catgegory = { contains: category, mode: 'insensitive' };
    }

    if (subcategory) {
      where.subcategory = { contains: subcategory, mode: 'insensitive' };
    }

    // Step 1: Get DB venues with votes
    const dbVenues = await this.prisma.client.venue.findMany({
      where,
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

    // Step 2: Get cached Google Places results
    const googlePlaces = await this.venueCacheService.getCachedPlaces(
      userLatitude,
      userLongitude,
    );

    // Step 3: Create a set of googlePlaceIds from DB venues for deduplication
    const dbGooglePlaceIds = new Set(
      dbVenues.filter((v) => v.googlePlaceId).map((v) => v.googlePlaceId),
    );

    // Step 4: Process DB venues
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

        // Calculate vote statistics
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

    // Step 5: Filter Google Places (exclude those already in DB)
    const filteredGooglePlaces = googlePlaces.filter(
      (place) => !dbGooglePlaceIds.has(place.placeId),
    );

    // Step 6: Transform Google Places to venue format
    let googleVenues: VenueResponse[] = filteredGooglePlaces.map((place) =>
      this.transformGooglePlaceToVenue(place, userLatitude, userLongitude),
    );

    // Apply search filter to Google venues
    if (search) {
      const searchLower = search.toLowerCase();
      googleVenues = googleVenues.filter(
        (v) =>
          v.name.toLowerCase().includes(searchLower) ||
          v.location.toLowerCase().includes(searchLower),
      );
    }

    // Apply category filter to Google venues
    if (category) {
      const categoryLower = category.toLowerCase();
      googleVenues = googleVenues.filter((v) =>
        v.category.toLowerCase().includes(categoryLower),
      );
    }

    if (subcategory) {
      const subcategoryLower = subcategory.toLowerCase();
      googleVenues = googleVenues.filter((v) =>
        v.subcategory.toLowerCase().includes(subcategoryLower),
      );
    }

    // Step 7: Merge DB and Google venues
    let allVenues = [...processedDbVenues, ...googleVenues];

    // Apply status filter
    if (status) {
      allVenues = allVenues.filter((v) => v.status === status);
    }

    // Apply boat count filter
    if (boatCount) {
      const minBoats = parseInt(boatCount);
      allVenues = allVenues.filter((v) => v.voteStats.total >= minBoats);
    }

    // Sort by distance (closest first)
    allVenues.sort((a, b) => a.distance - b.distance);

    // Pagination
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
    userLatitude?: number,
    userLongitude?: number,
  ): Promise<TResponse<any>> {
    const venue = await this.prisma.client.venue.findUnique({
      where: { id: venueId },
      include: {
        image: true,
        votes: {
          orderBy: { createdAt: 'desc' },
          take: 50, // Last 50 votes
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
        recentVotes: venue.votes.slice(0, 10), // Show 10 most recent votes
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
    let venue = await this.prisma.client.venue.findUnique({
      where: { id: venueId },
    });

    // If venue not found by ID, and googlePlaceId is provided, try to find or create
    if (!venue && dto.googlePlaceId) {
      // Check if venue exists by googlePlaceId
      venue = await this.prisma.client.venue.findUnique({
        where: { googlePlaceId: dto.googlePlaceId },
      });

      // If still not found, create from Google data
      if (!venue) {
        if (!dto.venueName) {
          throw new AppError(
            400,
            'Venue name is required when voting on a new Google venue',
          );
        }

        this.logger.log(
          `Creating new venue from Google Places: ${dto.venueName}`,
        );

        venue = await this.prisma.client.venue.create({
          data: {
            name: dto.venueName,
            googlePlaceId: dto.googlePlaceId,
            catgegory: dto.venueCategory || 'OTHER',
            subcategory: dto.venueSubcategory || 'GENERAL',
            location: dto.venueLocation || 'Unknown',
            latitude: dto.venueLatitude || dto.latitude,
            longitude: dto.venueLongitude || dto.longitude,
          },
        });

        this.logger.log(`Created venue with ID: ${venue.id}`);
      }
    }

    if (!venue) {
      throw new AppError(404, 'Venue not found');
    }

    // Validate user is near the venue (within 500 meters / 0.5 km)
    const MAX_DISTANCE_KM = 0.5; // 500 meters
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

    // Get updated venue status
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
