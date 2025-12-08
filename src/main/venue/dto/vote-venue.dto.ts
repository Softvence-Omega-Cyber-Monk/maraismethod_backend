import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
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
}
