import { Global, Module } from '@nestjs/common';
import { AdminSettingService } from './services/admin-setting.service';
import { FileService } from './services/file.service';
import { SuperAdminService } from './services/super-admin.service';

@Global()
@Module({
  imports: [],
  providers: [SuperAdminService, FileService, AdminSettingService],
})
export class SeedModule {}
