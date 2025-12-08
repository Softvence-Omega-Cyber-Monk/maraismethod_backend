import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';

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

  // @ApiPropertyOptional({
  //   description: 'Sort by createdAt or votes',
  //   example: 'createdAt',
  // })
  // @IsOptional()
  // @IsString()
  // sortBy?: string;

  // @ApiPropertyOptional({ description: 'Sort direction', example: 'desc' })
  // @IsOptional()
  // @IsString()
  // sortOrder?: 'asc' | 'desc';
}
