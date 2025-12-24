import { Module } from '@nestjs/common';
import { AdsModule } from './ads/ads.module';
import { AuthModule } from './auth/auth.module';
import { StatisticsModule } from './statistics/statistics.module';
import { UploadModule } from './upload/upload.module';
import { UserModule } from './user/user.module';
import { VenueModule } from './venue/venue.module';

@Module({
  imports: [
    AuthModule,
    UploadModule,
    VenueModule,
    AdsModule,
    UserModule,
    StatisticsModule,
  ],
})
export class MainModule {}
