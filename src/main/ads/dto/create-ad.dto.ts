import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdvertisementStatus } from '@prisma';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateAdDto {
  @ApiProperty({
    example: 'Summer Sale - 50% Off!',
    description: 'Title of the advertisement',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Get amazing discounts on all summer items. Limited time offer!',
    description: 'Description of the advertisement',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example: '123 Main Street, City',
    description: 'Location address where the ad is targeted',
  })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({
    example: 40.7128,
    description: 'Latitude coordinate of the ad location',
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({
    example: -74.006,
    description: 'Longitude coordinate of the ad location',
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiProperty({
    example: 10,
    description: 'Range in miles within which the ad should be shown',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  adShowRangeInMiles: number;

  @ApiProperty({
    example: AdvertisementStatus.RUNNING,
    enum: AdvertisementStatus,
    description: 'Status of the advertisement campaign',
  })
  @IsEnum(AdvertisementStatus)
  @IsNotEmpty()
  status: AdvertisementStatus;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Start date of the advertisement campaign',
  })
  @IsISO8601()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    example: '2024-12-31T23:59:59.000Z',
    description: 'End date of the advertisement campaign',
  })
  @IsISO8601()
  @IsNotEmpty()
  endDate: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional advertisement image/video file',
  })
  @IsOptional()
  file?: Express.Multer.File;

  @ApiPropertyOptional({
    example: 'https://example.com/promo',
    description: 'Optional URL for users to visit when clicking the ad',
  })
  @IsString()
  @IsOptional()
  link?: string;
}
