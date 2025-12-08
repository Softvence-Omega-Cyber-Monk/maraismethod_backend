import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAdminSettingDto {
  @ApiPropertyOptional({ description: 'Enable or disable push notifications' })
  @IsOptional()
  @IsBoolean()
  pushNotificationsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Show or hide search bar in app' })
  @IsOptional()
  @IsBoolean()
  showSearchBarInApp?: boolean;
}
