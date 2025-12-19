import { Module } from '@nestjs/common';
import { AdsModule } from './ads/ads.module';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { VenueModule } from './venue/venue.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [AuthModule, UploadModule, VenueModule, AdsModule, UserModule],
})
export class MainModule {}
