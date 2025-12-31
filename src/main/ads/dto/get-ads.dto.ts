import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class GetAdsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by title/description/location',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status (within date range)',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class GetAdsByLocationDto extends GetAdsDto {
  @ApiProperty({
    example: 40.7128,
    description: 'User latitude for location-based filtering',
  })
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty({
    example: -74.006,
    description: 'User longitude for location-based filtering',
  })
  @Type(() => Number)
  @IsNumber()
  longitude: number;
}

export class GetAdByIdDto {
  @ApiPropertyOptional({
    example: 40.7128,
    description: 'User latitude for distance calculation',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    example: -74.006,
    description: 'User longitude for distance calculation',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}
