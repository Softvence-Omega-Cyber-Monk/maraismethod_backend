import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable } from '@nestjs/common';
import { AdminLoginDto, LoginDto } from '../dto/login.dto';

@Injectable()
export class AuthLoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: AuthUtilsService,
    private readonly authMailService: AuthMailService,
  ) {}

  @HandleError('Login failed', 'User')
  async login(dto: LoginDto): Promise<TResponse<any>> {
    const { email, password } = dto;

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { email },
    });

    // Block admins from normal login
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      throw new AppError(403, 'Admin users must use the admin login endpoint.');
    }

    if (!user.password) {
      throw new AppError(
        400,
        'Password is not set for this user. Try social login.',
      );
    }
    const isPasswordCorrect = await this.utils.compare(password, user.password);
    if (!isPasswordCorrect) {
      throw new AppError(400, 'Invalid password');
    }

    // 2. Regular login
    const updatedUser = await this.prisma.client.user.update({
      where: { email },
      data: {
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
        fcmTokens: dto.fcmToken
          ? this.utils.addFcmToken(user.fcmTokens, dto.fcmToken)
          : user.fcmTokens,
      },
    });

    // 3. Generate token
    const token = await this.utils.generateTokenPairAndSave({
      email,
      role: updatedUser.role,
      sub: updatedUser.id,
    });

    return successResponse(
      {
        user: await this.utils.sanitizeUser(updatedUser),
        token,
      },
      'Logged in successfully',
    );
  }

  @HandleError('Admin login failed', 'User')
  async adminLogin(dto: AdminLoginDto): Promise<TResponse<any>> {
    const { email, password } = dto;

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { email },
    });

    // Only allow admins
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new AppError(403, 'This endpoint is only for admin users.');
    }

    if (!user.password) {
      throw new AppError(400, 'Password is not set for this user.');
    }

    const isPasswordCorrect = await this.utils.compare(password, user.password);
    if (!isPasswordCorrect) {
      throw new AppError(400, 'Invalid password');
    }

    // Check if 2FA is enabled
    if (user.isTFAEnabled) {
      // Generate and send OTP
      const otp = await this.utils.generateOTPAndSave(user.id, 'VERIFICATION');

      await this.authMailService.sendVerificationCodeEmail(
        email!,
        otp.toString(),
        {
          subject: 'Your 2FA Code',
          message:
            'Here is your 2FA verification code. It will expire in 5 minutes.',
        },
      );

      return successResponse(
        { email: user.email, requiresOTP: true },
        '2FA code sent to your email. Please verify to complete login.',
      );
    }

    // Proceed with normal login (no 2FA)
    const updatedUser = await this.prisma.client.user.update({
      where: { email },
      data: {
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      },
    });

    const token = await this.utils.generateTokenPairAndSave({
      email: email!,
      role: updatedUser.role,
      sub: updatedUser.id,
    });

    return successResponse(
      {
        user: await this.utils.sanitizeUser(updatedUser),
        token,
      },
      'Logged in successfully',
    );
  }
}
