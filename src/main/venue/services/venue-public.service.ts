import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import {
  GoogleMapsService,
  GooglePlaceResult,
} from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma';
import { QueryMode } from 'prisma/generated/internal/prismaNamespace';
import { GetPublicVenuesDto, GetSingleVenueDto } from '../dto/get-venues.dto';
import { VenueResponse } from '../interfaces/venue-response.interface';
import { VenueCacheService } from './venue-cache.service';
import { VenueHelperService } from './venue-helper.service';

@Injectable()
export class VenuePublicService {
  private readonly logger = new Logger(VenuePublicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly venueCacheService: VenueCacheService,
    private readonly helper: VenueHelperService,
    private readonly googleMapsService: GoogleMapsService,
  ) {}

  @HandleError('Failed to get venues')
  async getVenuesByLocation(dto: GetPublicVenuesDto): Promise<TResponse<any>> {
    const { page = 1, limit = 20, search, latitude, longitude } = dto;

    let dbWhere: Prisma.VenueWhereInput = {};

    // If search parameter is provided, search all venues without location filter
    if (search) {
      const searchOR: Prisma.VenueWhereInput[] = [
        { name: { contains: search, mode: QueryMode.insensitive } },
        { location: { contains: search, mode: QueryMode.insensitive } },
        { description: { contains: search, mode: QueryMode.insensitive } },
        { catgegory: { contains: search, mode: QueryMode.insensitive } },
        { subcategory: { contains: search, mode: QueryMode.insensitive } },
      ];

      dbWhere.OR = searchOR;
    } else {
      // Only apply location filter if no search parameter
      // Convert km to degrees
      const RADIUS_KM = 5;
      const ONE_DEG_LAT_KM = 111;

      const latDelta = RADIUS_KM / ONE_DEG_LAT_KM;
      const lonDelta = RADIUS_KM / (111 * Math.cos((latitude * Math.PI) / 180));

      const minLat = latitude - latDelta;
      const maxLat = latitude + latDelta;
      const minLng = longitude - lonDelta;
      const maxLng = longitude + lonDelta;

      dbWhere = {
        latitude: {
          gte: minLat,
          lte: maxLat,
        },
        longitude: {
          gte: minLng,
          lte: maxLng,
        },
      };
    }

    const dbVenues = await this.prisma.client.venue.findMany({
      where: dbWhere,
      include: {
        image: true,
        votes: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        _count: {
          select: {
            votes: true,
          },
        },
        operatingHours: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    // 2. Fetch venues from Google API (via cache)
    // Set enrichDetails=true to get full opening hours for all places
    const googlePlaces = await this.venueCacheService.getCachedPlaces(
      latitude,
      longitude,
      5000,
      search,
    );

    this.logger.debug(`Fetched ${googlePlaces.length} Google Places`);

    // 3. Process database venues
    const processedDbVenues: VenueResponse[] = await Promise.all(
      dbVenues.map(async (venue) => {
        const distance = this.helper.calculateDistance(
          latitude,
          longitude,
          venue.latitude,
          venue.longitude,
        );

        const venueStatus = await this.helper.getVenueStatus(venue.id);
        const lastVoteUpdate = await this.helper.getLastVoteUpdate(
          venue.id,
          venueStatus,
        );

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
          ...(await this.helper.getVenueOperationalDetails(
            venue.latitude,
            venue.longitude,
            venue.operatingHours,
          )),
          operatingHours: venue.operatingHours,
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

    // 4. Get DB Google Place IDs to avoid duplicates
    const dbGooglePlaceIds = new Set(
      dbVenues
        .filter((v) => v.googlePlaceId)
        .map((v) => v.googlePlaceId as string),
    );

    // 5. Transform and filter Google venues (excluding those already in DB)
    const allowedCategories = [
      'NIGHT CLUB',
      'BAR',
      'LOUNGE',
      'SPORTS BAR',
      'HOTEL BAR',
    ];

    const googleVenuesPromises = googlePlaces
      .filter((place) => !dbGooglePlaceIds.has(place.placeId))
      .map(async (place) => {
        const venue = await this.helper.transformGooglePlaceToVenue(
          place,
          latitude,
          longitude,
        );
        return venue;
      });

    const googleVenuesRaw = await Promise.all(googleVenuesPromises);
    // const googleVenues = googleVenuesRaw.filter((v) =>
    //   allowedCategories.includes(v.category),
    // );
    let googleVenues: VenueResponse[];

    if (search) {
      // If search exists, include all transformed Google venues (except duplicates)
      googleVenues = googleVenuesRaw;
    } else {
      // No search query → apply allowedCategories filter
      googleVenues = googleVenuesRaw.filter((v) =>
        allowedCategories.includes(v.category),
      );
    }

    // 6. Merge and sort by distance
    const allVenues = [...processedDbVenues, ...googleVenues];
    allVenues.sort((a, b) => a.distance - b.distance);

    // 7. Pagination
    const skip = (page - 1) * limit;
    const paginatedVenues = allVenues.slice(skip, skip + limit);

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
  async getVenueByGooglePlaceId(
    googlePlaceId: string,
    dto: GetSingleVenueDto,
  ): Promise<TResponse<any>> {
    // Check if this Google venue exists in database first
    const dbVenue = await this.prisma.client.venue.findFirst({
      where: { googlePlaceId },
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
        operatingHours: true,
      },
    });

    // If found in database, return database version with full details
    if (dbVenue) {
      return this.getDatabaseVenueDetails(dbVenue, dto);
    }

    // Fetch full details from Google for specific venue
    const details = await this.googleMapsService.getPlaceDetails(googlePlaceId);

    if (!details) {
      throw new AppError(404, 'Venue details not found from Google');
    }

    const googlePlaceResult: GooglePlaceResult = {
      placeId: googlePlaceId,
      name: details.name || 'Unknown',
      location: details.vicinity || details.formatted_address || '',
      latitude: details.geometry?.location?.lat,
      longitude: details.geometry?.location?.lng,
      category: this.googleMapsService.extractCategory(details.types || []),
      subcategory: this.googleMapsService.extractSubcategory(
        details.types || [],
      ),
      imageUrl: details.photos?.[0]
        ? this.googleMapsService.getPlacePhotoUrl(
            details.photos[0].photo_reference,
            400,
          )
        : '',
      types: details.types || [],
      openNow: details.opening_hours?.open_now ?? null,
      openingHours: details.opening_hours,
      operatingHours: this.googleMapsService.extractAllWeekHours(
        details.opening_hours?.periods,
      ),
    };

    const venueResponse = await this.helper.transformGooglePlaceToVenue(
      googlePlaceResult,
      dto.latitude,
      dto.longitude,
    );

    return successResponse(
      {
        ...venueResponse,
        recentVotes: [],
      },
      'Venue details retrieved successfully',
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
      const googlePlaceId = venueId.replace('google_', '');
      return this.getVenueByGooglePlaceId(googlePlaceId, dto);
    }

    // Regular database venue lookup

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
        operatingHours: true,
      },
    });

    if (!venue) {
      throw new AppError(404, 'Venue not found');
    }

    return this.getDatabaseVenueDetails(venue, dto);
  }

  /**
   * Helper method to get full database venue details
   */
  private async getDatabaseVenueDetails(
    venue: any,
    dto: GetSingleVenueDto,
  ): Promise<TResponse<any>> {
    const venueStatus = await this.helper.getVenueStatus(venue.id);
    const lastVoteUpdate = await this.helper.getLastVoteUpdate(
      venue.id,
      venueStatus,
    );

    const openVotes = venue.votes.filter((v: any) => v.isOpen).length;
    const closedVotes = venue.votes.filter((v: any) => !v.isOpen).length;

    const userLatitude = dto.latitude;
    const userLongitude = dto.longitude;

    let distance: number | null = null;
    if (userLatitude && userLongitude) {
      distance = parseFloat(
        this.helper
          .calculateDistance(
            userLatitude,
            userLongitude,
            venue.latitude,
            venue.longitude,
          )
          .toFixed(2),
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
        ...(await this.helper.getVenueOperationalDetails(
          venue.latitude,
          venue.longitude,
          venue.operatingHours,
        )),
        operatingHours: venue.operatingHours,
        distance,
        status: venueStatus,
        lastVoteUpdate,
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
}
