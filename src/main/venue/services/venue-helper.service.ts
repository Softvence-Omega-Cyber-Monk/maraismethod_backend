import { GooglePlaceResult } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
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

  async getLastVoteUpdate(venueId: string): Promise<Date | null> {
    const lastVote = await this.prisma.client.votes.findFirst({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
    });

    return lastVote?.createdAt || null;
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
}
