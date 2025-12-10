import { Module } from '@nestjs/common';
import { AdsModule } from './ads/ads.module';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { VenueModule } from './venue/venue.module';

@Module({
  imports: [AuthModule, UploadModule, VenueModule, AdsModule],
})
export class MainModule {}
