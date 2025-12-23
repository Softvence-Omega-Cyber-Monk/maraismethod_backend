import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateVenueDto {
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
    example: '09:00',
    description: 'Opening time (HH:mm)',
  })
  @IsString()
  @IsOptional()
  openTime?: string;

  @ApiPropertyOptional({
    example: '22:00',
    description: 'Closing time (HH:mm)',
  })
  @IsString()
  @IsOptional()
  closeTime?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional profile image',
  })
  @IsOptional()
  image?: Express.Multer.File;
}
