import { Module } from '@nestjs/common';
import { GetVenuesService } from './services/get-venues.service';
import { VenuePublicService } from './services/venue-public.service';
import { VenueService } from './services/venue.service';
import { VenueController } from './venue.controller';

@Module({
  controllers: [VenueController],
  providers: [VenueService, VenuePublicService, GetVenuesService],
})
export class VenueModule {}
