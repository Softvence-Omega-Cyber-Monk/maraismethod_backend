import { Module } from '@nestjs/common';
import { VenuePublicController } from './controllers/venue-public.controller';
import { VenueController } from './controllers/venue.controller';
import { GetVenuesService } from './services/get-venues.service';
import { VenueCacheService } from './services/venue-cache.service';
import { VenuePublicService } from './services/venue-public.service';
import { VenueService } from './services/venue.service';

@Module({
  controllers: [VenueController, VenuePublicController],
  providers: [
    VenueService,
    VenuePublicService,
    GetVenuesService,
    VenueCacheService,
  ],
})
export class VenueModule {}
