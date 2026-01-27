import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { GetAdByIdDto, GetAdsByLocationDto } from '../dto/get-ads.dto';
import { AdsPublicService } from '../services/ads-public.service';

@ApiTags('Ads (Public)')
@Controller('ads/public')
export class AdsPublicController {
  constructor(private readonly adsPublicService: AdsPublicService) {}

  @Get()
  @ApiOperation({
    summary:
      'Get advertisements by user location (within ad range) (records impressions)',
  })
  getAdsByLocation(@Query() dto: GetAdsByLocationDto) {
    return this.adsPublicService.getAdsByLocation(
      dto.latitude,
      dto.longitude,
      dto,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get advertisement details by ID (records click)',
  })
  @ApiParam({ name: 'id', description: 'Advertisement ID' })
  getAdById(@Param('id') id: string, @Query() dto: GetAdByIdDto) {
    return this.adsPublicService.getAdById(id, dto.latitude, dto.longitude);
  }

  @Post(':id/click')
  @ApiOperation({ summary: 'Record a click on an advertisement' })
  @ApiParam({ name: 'id', description: 'Advertisement ID' })
  recordClick(@Param('id') id: string) {
    return this.adsPublicService.recordClick(id);
  }
}
