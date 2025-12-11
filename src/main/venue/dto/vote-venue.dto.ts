import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class VoteVenueDto {
  @ApiProperty({
    example: true,
    description: 'Is the venue open or closed',
  })
  @IsBoolean()
  @IsNotEmpty()
  isOpen: boolean;

  @ApiProperty({
    example: 40.7128,
    description: 'User current latitude',
  })
  @Type(() => Number)
  @IsLatitude()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({
    example: -74.006,
    description: 'User current longitude',
  })
  @Type(() => Number)
  @IsLongitude()
  @IsNotEmpty()
  longitude: number;

  // Optional fields for creating venue from Google Places data
  @ApiPropertyOptional({
    example: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    description: 'Google Places API place_id (for venues from Google)',
  })
  @IsOptional()
  @IsString()
  googlePlaceId?: string;

  @ApiPropertyOptional({
    example: 'The Coffee Shop',
    description: 'Venue name (required if googlePlaceId is provided)',
  })
  @IsOptional()
  @IsString()
  venueName?: string;

  @ApiPropertyOptional({
    example: '123 Main Street',
    description: 'Venue location/address',
  })
  @IsOptional()
  @IsString()
  venueLocation?: string;

  @ApiPropertyOptional({
    example: 'RESTAURANT',
    description: 'Venue category',
  })
  @IsOptional()
  @IsString()
  venueCategory?: string;

  @ApiPropertyOptional({
    example: 'CAFE',
    description: 'Venue subcategory',
  })
  @IsOptional()
  @IsString()
  venueSubcategory?: string;

  @ApiPropertyOptional({
    example: 40.7128,
    description: 'Venue latitude (if different from user location)',
  })
  @IsOptional()
  @Type(() => Number)
  venueLatitude?: number;

  @ApiPropertyOptional({
    example: -74.006,
    description: 'Venue longitude (if different from user location)',
  })
  @IsOptional()
  @Type(() => Number)
  venueLongitude?: number;
}
