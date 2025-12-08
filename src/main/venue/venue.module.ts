import { Module } from '@nestjs/common';
import { VenuePublicService } from './services/venue-public.service';
import { VenuePublicController } from './venue-public.controller';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';
import { GetVenuesService } from './services/get-venues.service';

@Module({
  controllers: [VenueController, VenuePublicController],
  providers: [VenueService, VenuePublicService, GetVenuesService],
  exports: [VenueService, VenuePublicService],
})
export class VenueModule {}
