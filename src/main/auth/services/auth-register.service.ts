import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable } from '@nestjs/common';
import { RegisterDto } from '../dto/register.dto';

@Injectable()
export class AuthRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authMailService: AuthMailService,
    private readonly utils: AuthUtilsService,
  ) {}

  @HandleError('Registration failed', 'User')
  async register(dto: RegisterDto): Promise<TResponse<any>> {
    const { email, password } = dto;

    // Check if user email already exists
    const existingUser = await this.prisma.client.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new AppError(400, 'User already exists with this email');
    }

    // Create new user
    await this.prisma.client.user.create({
      data: {
        email,
        password: await this.utils.hash(password),
        isVerified: true,
      },
    });

    // Return sanitized response
    return successResponse(
      { email },
      `Registration successful. Please login to continue.`,
    );
  }
}
