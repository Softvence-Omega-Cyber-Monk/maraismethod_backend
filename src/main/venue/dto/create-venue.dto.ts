import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum CloseDayEnum {
  monday = 'monday',
  tuesday = 'tuesday',
  wednesday = 'wednesday',
  thursday = 'thursday',
  friday = 'friday',
  saturday = 'saturday',
  sunday = 'sunday',
}

export class OperatingHourDto {
  @ApiProperty({
    example: 1,
    description: 'Day of the week (1 = Monday, 7 = Sunday)',
  })
  @IsNumber()
  @IsNotEmpty()
  day: number;

  @ApiPropertyOptional({
    example: '09:00',
    description: 'Opening time in HH:mm format',
  })
  @IsString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({
    example: '18:00',
    description: 'Closing time in HH:mm format',
  })
  @IsString()
  @IsOptional()
  endTime?: string;
}

export class CreateVenueCoreInfoDto {
  @ApiProperty({
    example: 'The Grand Hall',
    description: 'Name of the venue',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Restaurant',
    description: 'Category of the venue',
  })
  @IsString()
  @IsNotEmpty()
  catgegory: string;

  @ApiProperty({
    example: 'Fine Dining',
    description: 'Subcategory of the venue',
  })
  @IsString()
  @IsNotEmpty()
  subcategory: string;

  @ApiProperty({
    example: '123 Main Street, City',
    description: 'Location address',
  })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({
    example: 40.7128,
    description: 'Latitude coordinate',
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({
    example: -74.006,
    description: 'Longitude coordinate',
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiPropertyOptional({
    example: 'A beautiful venue with great ambiance',
    description: 'Description of the venue',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Operating hours per day',
    type: () => [OperatingHourDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperatingHourDto)
  operatingHours?: OperatingHourDto[];
}

export class CreateVenueDto {
  @ApiProperty({ type: () => CreateVenueCoreInfoDto })
  @ValidateNested()
  @Type(() => CreateVenueCoreInfoDto)
  coreInfo: CreateVenueCoreInfoDto;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional profile image',
  })
  @IsOptional()
  image?: Express.Multer.File;
}
