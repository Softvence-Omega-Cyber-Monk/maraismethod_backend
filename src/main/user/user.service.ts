import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { GetUserDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllUsers(dto: GetUserDto) {
    const page = dto.page && dto.page > 0 ? dto.page : 1;
    const limit = dto.limit && dto.limit > 0 ? dto.limit : 10;
    const skip = (page - 1) * limit;

    const [users, total] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.user.count(),
    ]);

    // outout { mnaim, imageurl, email, lastactive at, created at, totalvoats}

    return successPaginatedResponse(
      users,
      { page, limit, total },
      'Users found',
    );
  }

  async getUserById(id: string) {
    const user = await this.prisma.client.user.findUnique({ where: { id } });

    return successResponse(user, 'User found');
  }

  async deleteUserById(id: string) {
    const user = await this.prisma.client.user.delete({ where: { id } });

    return successResponse(user, 'User deleted');
  }

  async toggleActiveDeactivate(id: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id },
    });

    if (user.status === 'ACTIVE') {
      await this.prisma.client.user.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
    } else {
      await this.prisma.client.user.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });
    }

    return successResponse(user, 'User updated');
  }
}
