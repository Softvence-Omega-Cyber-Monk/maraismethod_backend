import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export enum VenueStatusEnum {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export class GetVenuesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name/location/description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category', example: 'Resort' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter by subcategory',
    example: 'Beach',
  })
  @IsOptional()
  @IsString()
  subcategory?: string;

  @ApiPropertyOptional({
    description: 'Filter by status (open/closed)',
    enum: VenueStatusEnum,
  })
  @IsOptional()
  @IsEnum(VenueStatusEnum)
  status?: VenueStatusEnum;

  @ApiPropertyOptional({
    description: 'Filter by number of boats (votes count)',
    example: 5,
  })
  @IsOptional()
  @IsNumberString()
  boatCount?: string;
}

export class GetPublicVenuesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by name/location/description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'User latitude for distance calculation',
    example: 40.7128,
  })
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty({
    description: 'User longitude for distance calculation',
    example: -74.006,
  })
  @Type(() => Number)
  @IsNumber()
  longitude: number;
}

export class GetSingleVenueDto {
  @ApiProperty({
    description: 'User latitude for distance calculation',
    example: 40.7128,
  })
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty({
    description: 'User longitude for distance calculation',
    example: -74.006,
  })
  @Type(() => Number)
  @IsNumber()
  longitude: number;
}
