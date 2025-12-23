import { calculateDistanceInMiles, toRad } from '@/common/utils/distance.util';
import {
  GoogleMapsService,
  GooglePlaceResult,
} from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { VenueStatusEnum } from '../dto/get-venues.dto';
import { VenueResponse } from '../interfaces/venue-response.interface';

@Injectable()
export class VenueHelperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMapsService: GoogleMapsService,
  ) {}

  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    return calculateDistanceInMiles(lat1, lon1, lat2, lon2);
  }

  toRad(degrees: number): number {
    return toRad(degrees);
  }

  formatTimeToAmPm(time: string | null): string {
    if (!time || time === 'N/A') return 'N/A';
    const dt = DateTime.fromFormat(time, 'HH:mm');
    if (!dt.isValid) return time;
    return dt.toFormat('h:mm a');
  }

  async getVenueStatus(venueId: string): Promise<VenueStatusEnum> {
    const venue = await this.prisma.client.venue.findUnique({
      where: { id: venueId },
      include: {
        votes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!venue) return VenueStatusEnum.CLOSED;

    const votes = venue.votes;

    if (votes.length > 0) {
      const openVotes = votes.filter((v) => v.isOpen).length;
      const closedVotes = votes.filter((v) => !v.isOpen).length;

      return openVotes >= closedVotes
        ? VenueStatusEnum.OPEN
        : VenueStatusEnum.CLOSED;
    }

    // Fallback to start/end times if no votes exist
    if (venue.startTime && venue.endTime) {
      // Get the venue's local timezone using Google API
      const timezone = await this.googleMapsService.getTimezone(
        venue.latitude,
        venue.longitude,
      );

      const now = DateTime.now().setZone(timezone);
      const currentTimeStr = now.toFormat('HH:mm');

      // Simple string comparison for HH:mm format
      if (venue.startTime <= venue.endTime) {
        // Normal case (e.g., 09:00 - 22:00)
        return currentTimeStr >= venue.startTime &&
          currentTimeStr <= venue.endTime
          ? VenueStatusEnum.OPEN
          : VenueStatusEnum.CLOSED;
      } else {
        // Overnight case (e.g., 22:00 - 04:00)
        return currentTimeStr >= venue.startTime ||
          currentTimeStr <= venue.endTime
          ? VenueStatusEnum.OPEN
          : VenueStatusEnum.CLOSED;
      }
    }

    return VenueStatusEnum.CLOSED;
  }

  async getLastVoteUpdate(
    venueId: string,
    fallbackStatus?: VenueStatusEnum | null,
  ): Promise<string> {
    const lastVote = await this.prisma.client.votes.findFirst({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastVote?.createdAt) {
      return fallbackStatus
        ? `Currently ${fallbackStatus.toLowerCase()}`
        : 'Status updated 0 minutes ago';
    }

    const now = DateTime.now();
    const voteTime = DateTime.fromJSDate(lastVote.createdAt);

    const diff = now.diff(voteTime, ['days', 'hours', 'minutes']).toObject();

    let result = '';

    if (diff.days && diff.days >= 1) {
      const days = Math.floor(diff.days);
      const hours = Math.floor(diff.hours || 0);
      result = `${days} day${days > 1 ? 's' : ''}${hours > 0 ? ' ' + hours + ' hour' + (hours > 1 ? 's' : '') : ''}`;
    } else if (diff.hours && diff.hours >= 1) {
      const hours = Math.floor(diff.hours);
      const minutes = Math.floor(diff.minutes || 0);
      result = `${hours} hour${hours > 1 ? 's' : ''}${minutes > 0 ? ' ' + minutes + ' minute' + (minutes > 1 ? 's' : '') : ''}`;
    } else {
      const minutes = Math.max(Math.floor(diff.minutes || 0), 1);
      result = `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }

    return `Last updated ${result} ago`;
  }

  async transformGooglePlaceToVenue(
    place: GooglePlaceResult,
    userLatitude: number,
    userLongitude: number,
  ): Promise<VenueResponse> {
    const distance = this.calculateDistance(
      userLatitude,
      userLongitude,
      place.latitude,
      place.longitude,
    );

    // Get the venue's local timezone
    const timezone = await this.googleMapsService.getTimezone(
      place.latitude,
      place.longitude,
    );

    let status = VenueStatusEnum.CLOSED; // Default
    if (place.openNow === true) {
      status = VenueStatusEnum.OPEN;
    }

    let startTime: string = place.openTime || 'N/A';
    let endTime: string = place.closeTime || 'N/A';

    // If we have openingHours from Google Details, extract for today using local timezone
    if (place.openingHours?.periods) {
      const { openTime, closeTime } = this.googleMapsService.extractTodayHours(
        place.openingHours.periods,
        timezone,
      );
      if (openTime) startTime = openTime;
      if (closeTime) endTime = closeTime;
    }

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
      status,
      imageUrl: place.imageUrl,
      lastVoteUpdate: `Currently ${status.toLowerCase()}`,
      voteStats: {
        total: 0,
        open: 0,
        closed: 0,
      },
      source: 'google',
      startTime: this.formatTimeToAmPm(startTime),
      endTime: this.formatTimeToAmPm(endTime),
    };
  }

  extractCategory(types: string[]): string {
    const categoryMapping: Record<string, string> = {
      night_club: 'NIGHT CLUB',
      bar: 'BAR',
      lounge: 'LOUNGE',
      sports_bar: 'SPORTS BAR',
      hotel_bar: 'HOTEL BAR',
    };

    for (const t of types) {
      if (categoryMapping[t]) {
        return categoryMapping[t];
      }
    }

    return types[0]?.replace(/_/g, ' ').toUpperCase() || 'OTHER';
  }

  extractSubcategory(types: string[]): string {
    const subcategoryMapping: Record<string, string[]> = {
      'NIGHT CLUB': ['night_club', 'club', 'discotheque'],
      BAR: ['bar', 'pub', 'wine_bar'],
      LOUNGE: ['lounge', 'hookah_lounge', 'rooftop_lounge'],
      'SPORTS BAR': ['sports_bar'],
      'HOTEL BAR': ['hotel_bar'],
    };

    const category = this.extractCategory(types);

    const allowed = subcategoryMapping[category] || [];

    const match = types.find((t) => allowed.includes(t));

    return match?.replace(/_/g, ' ').toUpperCase() || category;
  }
}
