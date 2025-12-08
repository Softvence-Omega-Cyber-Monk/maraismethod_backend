import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John', description: 'Optional name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'john_doe',
    description: 'Optional username',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional profile image',
  })
  @IsOptional()
  image?: Express.Multer.File;
}
