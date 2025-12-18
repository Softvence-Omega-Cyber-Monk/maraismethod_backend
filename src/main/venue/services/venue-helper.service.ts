import { GooglePlaceResult } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { VenueStatusEnum } from '../dto/get-venues.dto';
import { VenueResponse } from '../interfaces/venue-response.interface';

@Injectable()
export class VenueHelperService {
  constructor(private readonly prisma: PrismaService) {}

  calculateDistance(
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

  toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  async getVenueStatus(venueId: string): Promise<VenueStatusEnum | null> {
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

  async getLastVoteUpdate(venueId: string): Promise<string | null> {
    const lastVote = await this.prisma.client.votes.findFirst({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastVote?.createdAt) return null;

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

  transformGooglePlaceToVenue(
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
      status: 'N/A',
      imageUrl: place.imageUrl,
      lastVoteUpdate: 'No votes yet',
      voteStats: {
        total: 0,
        open: 0,
        closed: 0,
      },
      source: 'google',
    };
  }
}
