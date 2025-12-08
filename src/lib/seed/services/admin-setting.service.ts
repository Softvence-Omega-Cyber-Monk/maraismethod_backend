import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class AdminSettingService implements OnModuleInit {
  private readonly logger = new Logger(AdminSettingService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): Promise<void> {
    return this.seedAdminSettings();
  }

  async seedAdminSettings(): Promise<void> {
    const existingSettings = await this.prisma.client.adminSetting.findFirst();

    if (!existingSettings) {
      await this.prisma.client.adminSetting.create({
        data: {
          pushNotificationsEnabled: true,
          showSearchBarInApp: true,
        },
      });
      this.logger.log('[CREATE] Admin settings created with default values');
      return;
    }

    this.logger.log('[EXISTS] Admin settings already exist');
  }
}
