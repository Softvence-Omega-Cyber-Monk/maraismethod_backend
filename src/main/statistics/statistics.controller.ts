import { ValidateAdmin } from '@/core/jwt/jwt.decorator';
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';

@ApiTags('Statistics (Admin)')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Get general analytics data' })
  getAnalytics() {
    return this.statisticsService.getAnalytics();
  }

  @Get('recent-venues')
  @ApiOperation({ summary: 'Get recently added venues' })
  getRecentVenues() {
    return this.statisticsService.getRecentVenues();
  }

  @Get('recent-votes')
  @ApiOperation({ summary: 'Get recent votes' })
  getRecentVotes() {
    return this.statisticsService.getRecentVotes();
  }
}
