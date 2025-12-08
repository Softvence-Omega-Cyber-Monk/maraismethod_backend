import { Module } from '@nestjs/common';
import { VenueController } from './controllers/venue.controller';
import { GetVenuesService } from './services/get-venues.service';
import { VenuePublicService } from './services/venue-public.service';
import { VenueService } from './services/venue.service';
import { VenuePublicController } from './controllers/venue-public.controller';

@Module({
  controllers: [VenueController, VenuePublicController],
  providers: [VenueService, VenuePublicService, GetVenuesService],
})
export class VenueModule {}
