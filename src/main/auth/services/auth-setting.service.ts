import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { UpdateAdminSettingDto } from '../dto/update-admin-setting.dto';

@Injectable()
export class AuthSettingService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get settings')
  async getSettings(userId: string) {
    const [user, adminSettings] = await Promise.all([
      this.prisma.client.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.client.adminSetting.findFirstOrThrow(),
    ]);

    // Merge settings: admin values but 2FA comes from user
    const mergedSettings = {
      ...adminSettings,
      adminLoginTFAEnabled: user.isTFAEnabled,
    };

    return successResponse(mergedSettings, 'Settings retrieved successfully');
  }

  @HandleError('Failed to update admin settings')
  async updateSettings(dto: UpdateAdminSettingDto) {
    const settings = await this.prisma.client.adminSetting.findFirstOrThrow();

    const updatedSettings = await this.prisma.client.adminSetting.update({
      where: { id: settings.id },
      data: {
        pushNotificationsEnabled:
          dto.pushNotificationsEnabled ?? settings.pushNotificationsEnabled,
        showSearchBarInApp:
          dto.showSearchBarInApp ?? settings.showSearchBarInApp,
      },
    });

    return successResponse(
      updatedSettings,
      'Admin settings updated successfully',
    );
  }

  @HandleError('Failed to toggle admin setting')
  async toggle(key: keyof UpdateAdminSettingDto) {
    const settings = await this.prisma.client.adminSetting.findFirstOrThrow();

    const newValue = !settings[key];

    const updatedSettings = await this.prisma.client.adminSetting.update({
      where: { id: settings.id },
      data: { [key]: newValue },
    });

    return successResponse(
      updatedSettings,
      `Admin setting '${key}' toggled successfully`,
    );
  }

  @HandleError('Failed to toggle 2FA')
  async toggle2FA(userId: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const updatedUser = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        isTFAEnabled: !user.isTFAEnabled,
      },
    });

    return successResponse(
      { isTFAEnabled: updatedUser.isTFAEnabled },
      `2FA ${updatedUser.isTFAEnabled ? 'enabled' : 'disabled'} successfully`,
    );
  }
}
