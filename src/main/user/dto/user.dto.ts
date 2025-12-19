import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GetUserDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Filter users by status',
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Search term for users',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
