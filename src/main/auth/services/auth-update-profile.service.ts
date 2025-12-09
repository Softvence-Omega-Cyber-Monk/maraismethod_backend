import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { S3Service } from '@/lib/file/services/s3.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable } from '@nestjs/common';
import { FileInstance } from '@prisma';
import { UpdateProfileDto } from '../dto/update-profile.dto';

@Injectable()
export class AuthUpdateProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authUtils: AuthUtilsService,
    private readonly s3: S3Service,
  ) {}

  @HandleError('Failed to update profile', 'User')
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // * Handle password change
    let hashedPassword: string | undefined;
    if (dto.newPassword) {
      if (user.password) {
        // User has an existing password → current password required
        if (!dto.password) {
          throw new AppError(
            400,
            'Current password is required to set a new password',
          );
        }

        const isValid = await this.authUtils.compare(
          dto.password,
          user.password,
        );
        if (!isValid) throw new AppError(400, 'Invalid current password');
      }
      // If user has no password (social login), allow setting new password directly
      hashedPassword = await this.authUtils.hash(dto.newPassword);
    }

    // * Check if username is provided and available
    if (dto.username?.trim()) {
      const existingUser = await this.prisma.client.user.findUnique({
        where: { username: dto.username.trim() },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new AppError(400, 'Username is already taken');
      }
    }

    // * Handle profile image upload
    let fileInstance: FileInstance | undefined;
    if (file) {
      const uploadFile = await this.s3.uploadFile(file);

      if (uploadFile) {
        fileInstance = uploadFile;
      }

      // Delete previous profile picture if exists
      if (user.profilePictureId) {
        await this.s3.deleteFile(user.profilePictureId);
      }
    }

    // * Update user
    const updatedUser = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        name: dto.name?.trim() ? dto.name.trim() : user.name,
        ...(hashedPassword && { password: hashedPassword }),
        ...(fileInstance && {
          profilePicture: {
            connect: fileInstance,
          },
          profilePictureURL: fileInstance.url,
        }),
        username: dto.username?.trim() ? dto.username.trim() : user.username,
      },
      include: { profilePicture: true },
    });

    return successResponse(
      await this.authUtils.sanitizeUser(updatedUser),
      'Profile updated successfully',
    );
  }
}
