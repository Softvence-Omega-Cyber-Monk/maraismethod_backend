import {
  successPaginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma';
import { GetUserDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError("Can't get all users")
  async getAllUsers(dto: GetUserDto) {
    const page = dto.page && dto.page > 0 ? dto.page : 1;
    const limit = dto.limit && dto.limit > 0 ? dto.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { username: { contains: dto.search, mode: 'insensitive' } },
        { email: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          status: true,
          role: true,
          profilePictureURL: true,
          lastActiveAt: true,
          createdAt: true,
          votes: { select: { id: true } },
        },
      }),
      this.prisma.client.user.count({ where }),
    ]);

    const safeUsers = users.map((user) => ({
      ...user,
      totalVotes: user.votes.length,
      votes: undefined, // remove raw votes array
    }));

    return successPaginatedResponse(
      safeUsers,
      { page, limit, total },
      'Users found',
    );
  }

  @HandleError("Can't get user by id")
  async getUserById(id: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        status: true,
        role: true,
        profilePictureURL: true,
        lastActiveAt: true,
        createdAt: true,
        votes: { select: { id: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return successResponse(
      {
        ...user,
        totalVotes: user.votes.length,
        votes: undefined,
      },
      'User found',
    );
  }

  @HandleError("Can't delete user by id")
  async deleteUserById(id: string) {
    await this.prisma.client.user.findUniqueOrThrow({
      where: { id },
    });

    await this.prisma.client.user.delete({
      where: { id },
    });

    return successResponse(null, 'User deleted');
  }

  @HandleError("Can't toggle user status")
  async toggleActiveDeactivate(id: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id },
      select: { id: true, status: true },
    });

    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updatedUser = await this.prisma.client.user.update({
      where: { id },
      data: { status: newStatus },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        status: true,
        role: true,
        profilePictureURL: true,
        lastActiveAt: true,
        createdAt: true,
      },
    });

    return successResponse(updatedUser, 'User updated');
  }
}
