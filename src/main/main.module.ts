import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { VenueModule } from './venue/venue.module';

@Module({
  imports: [AuthModule, UploadModule, VenueModule],
})
export class MainModule {}
