import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { GetVenuesDto, VenueStatusEnum } from '../dto/get-venues.dto';
import { VoteVenueDto } from '../dto/vote-venue.dto';

@Injectable()
export class VenuePublicService {
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

    // Build where clause
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

    // Get all venues with votes
    const venues = await this.prisma.client.venue.findMany({
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

    // Process venues with distance, status, and filtering
    const processedVenues = await Promise.all(
      venues.map(async (venue) => {
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
          category: venue.catgegory,
          subcategory: venue.subcategory,
          location: venue.location,
          latitude: venue.latitude,
          longitude: venue.longitude,
          description: venue.description,
          imageUrl: venue.imageUrl,
          image: venue.image,
          distance: parseFloat(distance.toFixed(2)), // Distance in km
          status: venueStatus,
          lastVoteUpdate,
          voteStats: {
            total: totalVotes,
            open: openVotes,
            closed: closedVotes,
          },
          createdAt: venue.createdAt,
          updatedAt: venue.updatedAt,
        };
      }),
    );

    // Apply status filter
    let filteredVenues = processedVenues;
    if (status) {
      filteredVenues = processedVenues.filter((v) => v.status === status);
    }

    // Apply boat count filter
    if (boatCount) {
      const minBoats = parseInt(boatCount);
      filteredVenues = filteredVenues.filter(
        (v) => v.voteStats.total >= minBoats,
      );
    }

    // Sort by distance (closest first)
    filteredVenues.sort((a, b) => a.distance - b.distance);

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedVenues = filteredVenues.slice(skip, skip + limit);

    return successResponse(
      {
        venues: paginatedVenues,
        pagination: {
          total: filteredVenues.length,
          page,
          limit,
          totalPages: Math.ceil(filteredVenues.length / limit),
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
    // Check if venue exists
    const venue = await this.prisma.client.venue.findUnique({
      where: { id: venueId },
    });

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
        venueId,
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
        venueId,
        isOpen: dto.isOpen,
      },
    });

    // Get updated venue status
    const venueStatus = await this.getVenueStatus(venueId);

    return successResponse(
      {
        vote,
        currentStatus: venueStatus,
        message: `Your vote has been recorded. You were ${(distance * 1000).toFixed(0)} meters from the venue.`,
      },
      'Vote recorded successfully',
    );
  }
}
