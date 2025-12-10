import { Module } from '@nestjs/common';
import { AdsPublicController } from './controllers/ads-public.controller';
import { AdsController } from './controllers/ads.controller';
import { AdsPublicService } from './services/ads-public.service';
import { AdsService } from './services/ads.service';
import { GetAdsService } from './services/get-ads.service';

@Module({
  controllers: [AdsController, AdsPublicController],
  providers: [AdsService, AdsPublicService, GetAdsService],
})
export class AdsModule {}
