import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { VenuePublicService } from '../services/venue-public.service';

@ApiTags('Venue (Public)')
@Controller('venue-public')
export class VenuePublicController {
  constructor(private readonly venuePublicService: VenuePublicService) {}

  @Get()
  @ApiOperation({ summary: 'Get all venues (Public)' })
  findAll() {
    return this.venuePublicService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a venue by ID (Public)' })
  @ApiParam({ name: 'id', description: 'Venue ID' })
  findOne(@Param('id') id: string) {
    return this.venuePublicService.findOne(id);
  }
}
