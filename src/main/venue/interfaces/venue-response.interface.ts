import { VenueStatusEnum } from '../dto/get-venues.dto';

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
