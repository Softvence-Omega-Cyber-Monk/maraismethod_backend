import { ValidateAdmin } from '@/core/jwt/jwt.decorator';
import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUserDto } from './dto/user.dto';
import { UserService } from './user.service';

@ApiTags('User (Admin)')
@Controller('user')
@ApiBearerAuth()
@ValidateAdmin()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: 'Get all users' })
  @Get()
  async getAllUsers(@Query() dto: GetUserDto) {
    return this.userService.getAllUsers(dto);
  }

  @ApiOperation({ summary: 'Get user by id' })
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  @ApiOperation({ summary: 'Delete user by id' })
  @Delete(':id/delete')
  async deleteUserById(@Param('id') id: string) {
    return this.userService.deleteUserById(id);
  }

  @ApiOperation({ summary: 'Toggle user active/deactivate' })
  @Patch(':id/toggle-active-deactivate')
  async toggleActiveDeactivate(@Param('id') id: string) {
    return this.userService.toggleActiveDeactivate(id);
  }
}
