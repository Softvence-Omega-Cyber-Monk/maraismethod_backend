import { GetUser, ValidateAuth } from '@/core/jwt/jwt.decorator';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { GetVenuesDto } from '../dto/get-venues.dto';
import { VoteVenueDto } from '../dto/vote-venue.dto';
import { VenuePublicService } from '../services/venue-public.service';

@ApiTags('Venue (Public)')
@Controller('venue/public')
export class VenuePublicController {
  constructor(private readonly venuePublicService: VenuePublicService) {}

  @Get()
  @ApiOperation({
    summary: 'Get venues by user location with distance and status',
  })
  @ApiQuery({ name: 'latitude', required: true, example: 40.7128 })
  @ApiQuery({ name: 'longitude', required: true, example: -74.006 })
  getVenuesByLocation(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query() dto: GetVenuesDto,
  ) {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    return this.venuePublicService.getVenuesByLocation(lat, lon, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get venue details by ID' })
  @ApiParam({ name: 'id', description: 'Venue ID' })
  @ApiQuery({
    name: 'latitude',
    required: false,
    example: 40.7128,
    description: 'User latitude for distance calculation',
  })
  @ApiQuery({
    name: 'longitude',
    required: false,
    example: -74.006,
    description: 'User longitude for distance calculation',
  })
  getVenueById(
    @Param('id') id: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
  ) {
    const lat = latitude ? parseFloat(latitude) : undefined;
    const lon = longitude ? parseFloat(longitude) : undefined;

    return this.venuePublicService.getVenueById(id, lat, lon);
  }

  @Post(':id/vote')
  @ApiBearerAuth()
  @ValidateAuth()
  @ApiOperation({ summary: 'Vote for venue status (open/closed)' })
  @ApiParam({ name: 'id', description: 'Venue ID' })
  voteForVenue(
    @GetUser('sub') userId: string,
    @Param('id') venueId: string,
    @Body() dto: VoteVenueDto,
  ) {
    return this.venuePublicService.voteForVenue(userId, venueId, dto);
  }
}
