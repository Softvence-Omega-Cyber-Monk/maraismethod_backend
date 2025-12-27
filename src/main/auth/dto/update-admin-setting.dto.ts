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

  @ApiPropertyOptional({ description: 'Validate User location while voting' })
  @IsOptional()
  @IsBoolean()
  shouldValidateLocation?: boolean;

  @ApiPropertyOptional({
    description: 'Validate User both frequency while voting',
  })
  @IsOptional()
  @IsBoolean()
  shouldValidateTime?: boolean;
}
