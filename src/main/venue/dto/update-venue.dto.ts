import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { CreateVenueCoreInfoDto } from './create-venue.dto';

export class UpdateVenueCoreInfoDto extends PartialType(
  CreateVenueCoreInfoDto,
) {}

export class UpdateVenueDto {
  @ApiPropertyOptional({ type: () => UpdateVenueCoreInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateVenueCoreInfoDto)
  coreInfo?: UpdateVenueCoreInfoDto;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional profile image',
  })
  @IsOptional()
  image?: Express.Multer.File;
}
