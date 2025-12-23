import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import {
  GoogleMapsService,
  GooglePlaceResult,
} from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
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
        const distance = this.helper.calculateDistance(
          userLatitude,
          userLongitude,
          venue.latitude,
          venue.longitude,
        );

        const venueStatus = await this.helper.getVenueStatus(venue.id);
        const lastVoteUpdate = await this.helper.getLastVoteUpdate(venue.id);

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
          openTime: venue.openTime,
          closeTime: venue.closeTime,
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
      this.helper.transformGooglePlaceToVenue(
        place,
        userLatitude,
        userLongitude,
      ),
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
      const googlePlaceId = venueId.replace('google_', '');

      // Fetch full details from Google for specific venue
      const details =
        await this.googleMapsService.getPlaceDetails(googlePlaceId);

      if (!details) {
        throw new AppError(404, 'Venue details not found from Google');
      }

      // Transform using helper (which now extracts hours)
      const GoogleMapsResult: GooglePlaceResult = {
        placeId: googlePlaceId,
        name: details.name,
        location: details.vicinity || details.formatted_address,
        latitude: details.geometry?.location?.lat,
        longitude: details.geometry?.location?.lng,
        category: (this.googleMapsService as any).extractCategory(
          details.types,
        ),
        subcategory: (this.googleMapsService as any).extractSubcategory(
          details.types,
        ),
        imageUrl: details.photos?.[0]
          ? this.googleMapsService.getPlacePhotoUrl(
              details.photos[0].photo_reference,
            )
          : '',
        types: details.types || [],
        openNow: details.opening_hours?.open_now,
        openingHours: details.opening_hours,
      };

      const venueResponse = this.helper.transformGooglePlaceToVenue(
        GoogleMapsResult,
        dto.latitude,
        dto.longitude,
      );

      return successResponse(
        {
          ...venueResponse,
          category: this.helper.extractCategory(details.types || []),
          subcategory: this.helper.extractSubcategory(details.types || []),
          recentVotes: [],
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

    const venueStatus = await this.helper.getVenueStatus(venue.id);
    const lastVoteUpdate = await this.helper.getLastVoteUpdate(venue.id);

    const openVotes = venue.votes.filter((v) => v.isOpen).length;
    const closedVotes = venue.votes.filter((v) => !v.isOpen).length;

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
        openTime: venue.openTime,
        closeTime: venue.closeTime,
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
}
