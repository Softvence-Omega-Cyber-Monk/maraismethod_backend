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

    const timezone = await this.googleMapsService.getTimezone(
      venue.latitude,
      venue.longitude,
    );

    // 1. Check STRICT operating hours
    // Convert DB hours to Google-like periods for unified logic
    const periods = this.convertDBHoursToPeriods(venue);
    const isStrictlyOpen = this.isWithinPeriods(periods, timezone);

    if (!isStrictlyOpen) {
      return VenueStatusEnum.CLOSED;
    }

    // 2. Voting Logic - Restarts at 8 AM Eastern Time (ET)
    const etZone = 'America/New_York';
    const nowEt = DateTime.now().setZone(etZone);
    let voteDayStart = nowEt.set({
      hour: 8,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

    if (nowEt < voteDayStart) {
      voteDayStart = voteDayStart.minus({ days: 1 });
    }

    const todayVotes = venue.votes.filter(
      (v) => DateTime.fromJSDate(v.createdAt) >= voteDayStart,
    );

    if (todayVotes.length > 0) {
      const openVotes = todayVotes.filter((v) => v.isOpen).length;
      const closedVotes = todayVotes.filter((v) => !v.isOpen).length;

      return openVotes >= closedVotes
        ? VenueStatusEnum.OPEN
        : VenueStatusEnum.CLOSED;
    }

    return VenueStatusEnum.OPEN; // Default to OPEN if within hours and no votes
  }

  /**
   * Check if the current time in the given timezone falls within any of the provided periods.
   */
  private isWithinPeriods(periods: any[], timezone: string): boolean {
    if (!periods || periods.length === 0) return false;

    const now = DateTime.now().setZone(timezone);
    const currentDay = now.weekday === 7 ? 0 : now.weekday; // Google: 0=Sun, 6=Sat
    const currentTimeStr = now.toFormat('HHmm');

    for (const period of periods) {
      const openDay = period.open.day;
      const openTime = period.open.time;
      const closeDay = period.close?.day;
      const closeTime = period.close?.time;

      if (closeDay === undefined || closeTime === undefined) {
        // Venue is open 24/7 or has no close time
        return true;
      }

      // Check if current time falls within this period
      if (openDay === closeDay) {
        // Same day: e.g. 0900 to 1700
        if (
          currentDay === openDay &&
          currentTimeStr >= openTime &&
          currentTimeStr <= closeTime
        ) {
          return true;
        }
      } else {
        // Crosses day boundary: e.g. Sunday 1700 to Monday 0400
        // We are in this period if:
        // 1. It's the openDay and we are after openTime
        if (currentDay === openDay && currentTimeStr >= openTime) {
          return true;
        }
        // 2. It's the closeDay and we are before closeTime
        if (currentDay === closeDay && currentTimeStr <= closeTime) {
          return true;
        }
        // 3. It's a day in between (not applicable for simple pairs, but for some Google data it might be)
      }
    }

    return false;
  }

  /**
   * Helper to convert Database Venue hours/closedDays to Google-like periods
   */
  private convertDBHoursToPeriods(venue: any): any[] {
    if (!venue.startTime || !venue.endTime) return [];

    const periods: any[] = [];
    const days = [0, 1, 2, 3, 4, 5, 6]; // 0=Sun
    const dayMapping: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const closedDaysSet = new Set(
      (venue.closedDays || []).map((d: string) => dayMapping[d.toLowerCase()]),
    );
    const startTimeStr = venue.startTime.replace(':', '');
    const endTimeStr = venue.endTime.replace(':', '');

    for (const day of days) {
      if (closedDaysSet.has(day)) continue;

      let closeDay = day;
      if (startTimeStr > endTimeStr) {
        closeDay = (day + 1) % 7;
      }

      periods.push({
        open: { day, time: startTimeStr },
        close: { day: closeDay, time: endTimeStr },
      });
    }

    return periods;
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
        : 'Last updated 0 minutes ago';
      // return 'Last updated 0 minutes ago';
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

    let startTime: string = place.openTime || 'N/A';
    let endTime: string = place.closeTime || 'N/A';
    const periods: any[] = place.openingHours?.periods || [];

    // If we have openingHours from Google Details, extract for today using local timezone
    if (place.openingHours?.periods) {
      const { openTime, closeTime } = this.googleMapsService.extractTodayHours(
        place.openingHours.periods,
        timezone,
      );
      if (openTime) startTime = openTime;
      if (closeTime) endTime = closeTime;
    }

    // Strict Hours Check
    const isStrictlyOpen = this.isWithinPeriods(periods, timezone);
    const status = isStrictlyOpen
      ? VenueStatusEnum.OPEN
      : VenueStatusEnum.CLOSED;

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
      lastVoteUpdate: 'Last updated 0 minutes ago',
      voteStats: {
        total: 0,
        open: 0,
        closed: 0,
      },
      source: 'google',
      startTime: this.formatTimeToAmPm(startTime),
      endTime: this.formatTimeToAmPm(endTime),
      closedDays: null, // Google venues don't have closedDays data
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
