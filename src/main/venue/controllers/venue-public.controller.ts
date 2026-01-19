import { GetUser, ValidateAuth } from '@/core/jwt/jwt.decorator';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetPublicVenuesDto, GetSingleVenueDto } from '../dto/get-venues.dto';
import { VoteVenueDto } from '../dto/vote-venue.dto';
import { VenuePublicService } from '../services/venue-public.service';
import { VenueVoteService } from '../services/venue-vote.service';

@ApiTags('Venue (Public)')
@Controller('venue/public')
export class VenuePublicController {
  constructor(
    private readonly venuePublicService: VenuePublicService,
    private readonly venueVoteService: VenueVoteService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get venues by user location with distance and status',
  })
  getVenuesByLocation(@Query() dto: GetPublicVenuesDto) {
    return this.venuePublicService.getVenuesByLocation(dto);
  }

  @Get('google/:placeId')
  @ApiOperation({
    summary: 'Get venue details by Google Place ID (for SDK integration)',
  })
  getVenueByGooglePlaceId(
    @Param('placeId') placeId: string,
    @Query() dto: GetSingleVenueDto,
  ) {
    return this.venuePublicService.getVenueByGooglePlaceId(placeId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get venue details by ID)' })
  getVenueById(@Param('id') id: string, @Query() dto: GetSingleVenueDto) {
    return this.venuePublicService.getVenueById(id, dto);
  }

  @Post(':id/vote')
  @ApiBearerAuth()
  @ValidateAuth()
  @ApiOperation({ summary: 'Vote for venue status (open/closed)' })
  voteForVenue(
    @GetUser('sub') userId: string,
    @Param('id') venueId: string,
    @Body() dto: VoteVenueDto,
  ) {
    return this.venueVoteService.voteForVenue(userId, venueId, dto);
  }
}
