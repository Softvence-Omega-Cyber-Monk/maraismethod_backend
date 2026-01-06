import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma, Venue, Votes } from '@prisma';
import { GetVenuesDto } from '../dto/get-venues.dto';

@Injectable()
export class GetVenuesService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get venues')
  async getCreatedVenues(dto: GetVenuesDto) {
    const page = dto.page && dto.page > 0 ? dto.page : 1;
    const limit = dto.limit && dto.limit > 0 ? dto.limit : 10;
    const skip = (page - 1) * limit;

    const venueWhere: Prisma.VenueWhereInput = {
      source: 'database',
    };

    if (dto.category) venueWhere.catgegory = dto.category;
    if (dto.subcategory) venueWhere.subcategory = dto.subcategory;

    if (dto.search) {
      const q = dto.search;
      venueWhere.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { catgegory: { contains: q, mode: 'insensitive' } },
        { subcategory: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Step 1: fetch all candidate venues matching category/search filters
    let candidateVenues = await this.prisma.client.venue.findMany({
      where: venueWhere,
      include: { votes: true },
      orderBy: { createdAt: 'desc' },
    });

    // Step 2: apply boatCount filter if provided
    if (dto.boatCount) {
      const minBoatCount = Number(dto.boatCount);
      candidateVenues = candidateVenues.filter(
        (v) => (v.votes?.length ?? 0) >= minBoatCount,
      );
    }

    // Step 3: total count after filters
    const total = candidateVenues.length;

    // Step 4: apply pagination
    const paginatedVenues = candidateVenues.slice(skip, skip + limit);

    // Step 5: transform each venue with stats
    const transformedVenues = await Promise.all(
      paginatedVenues.map((venue) => this.transformVenueWithStats(venue)),
    );

    return successPaginatedResponse(
      transformedVenues,
      { total, page, limit },
      'Venues found',
    );
  }

  @HandleError('Failed to get venues')
  async getAllVenues(dto: GetVenuesDto) {
    const page = dto.page && dto.page > 0 ? dto.page : 1;
    const limit = dto.limit && dto.limit > 0 ? dto.limit : 10;
    const skip = (page - 1) * limit;

    const venueWhere: Prisma.VenueWhereInput = {};

    if (dto.category) venueWhere.catgegory = dto.category;
    if (dto.subcategory) venueWhere.subcategory = dto.subcategory;

    if (dto.search) {
      const q = dto.search;
      venueWhere.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { catgegory: { contains: q, mode: 'insensitive' } },
        { subcategory: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Step 1: fetch all candidate venues matching category/search filters
    let candidateVenues = await this.prisma.client.venue.findMany({
      where: venueWhere,
      include: { votes: true },
      orderBy: { createdAt: 'desc' },
    });

    // Step 2: apply boatCount filter if provided
    if (dto.boatCount) {
      const minBoatCount = Number(dto.boatCount);
      candidateVenues = candidateVenues.filter(
        (v) => (v.votes?.length ?? 0) >= minBoatCount,
      );
    }

    // Step 3: total count after filters
    const total = candidateVenues.length;

    // Step 4: apply pagination
    const paginatedVenues = candidateVenues.slice(skip, skip + limit);

    // Step 5: transform each venue with stats
    const transformedVenues = await Promise.all(
      paginatedVenues.map((venue) => this.transformVenueWithStats(venue)),
    );

    return successPaginatedResponse(
      transformedVenues,
      { total, page, limit },
      'Venues found',
    );
  }

  @HandleError('Failed to get venue')
  async getSingleVenue(id: string) {
    const venue = await this.prisma.client.venue.findUniqueOrThrow({
      where: { id },
      include: { votes: true },
    });

    const transformedVenue = await this.transformVenueWithStats(venue);

    return successResponse(transformedVenue, 'Venue found');
  }

  private transformVenueWithStats = (venue: Venue & { votes: Votes[] }) => {
    const votes = venue.votes ?? [];

    const total = votes.length;

    const openVotes = votes.filter((v) => v.isOpen).length;

    const openPercent = total > 0 ? Math.round((openVotes / total) * 100) : 0;
    const closedPercent = total > 0 ? 100 - openPercent : 0;

    // Today's stats
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todaysOpen = votes.filter(
      (v) => v.isOpen && v.createdAt >= startOfToday,
    ).length;

    const todaysClosed = votes.filter(
      (v) => !v.isOpen && v.createdAt >= startOfToday,
    ).length;

    return {
      ...venue,
      stats: {
        total,
        openPercent,
        closedPercent,
        todays: {
          open: todaysOpen,
          close: todaysClosed,
        },
      },
    };
  };
}
