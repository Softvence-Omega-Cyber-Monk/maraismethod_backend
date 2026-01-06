import { VenueStatusEnum } from '../dto/get-venues.dto';

export interface OperatingHoursResponse {
  day: number;
  startTime: string | null;
  endTime: string | null;
}

export interface VenueResponse {
  id: string;
  name: string;
  googlePlaceId?: string | null;
  category: string;
  subcategory: string;
  location: string;
  latitude: number;
  longitude: number;
  distance: number;
  status: VenueStatusEnum | null | 'N/A';
  lastVoteUpdate: Date | string | null;
  voteStats: {
    total: number;
    open: number;
    closed: number;
  };
  source: 'database' | 'google';
  description?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  closedDays?: string[] | null;
  operatingHours?: OperatingHoursResponse[];

  imageUrl: string | null;
  image?: any;
  createdAt?: Date;
  updatedAt?: Date;
}
