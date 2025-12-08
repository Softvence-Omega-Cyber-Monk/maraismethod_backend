import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { FirebaseService } from '@/lib/firebase/firebase.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable } from '@nestjs/common';
import { SocialLoginDto } from '../dto/social-login.dto';

@Injectable()
export class AuthSocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: AuthUtilsService,
    private readonly firebaseService: FirebaseService,
  ) {}

  @HandleError('Social login failed', 'User')
  async socialLogin(dto: SocialLoginDto): Promise<TResponse<any>> {
    const { idToken } = dto;

    // 1. Verify token with Firebase
    const decodedToken = await this.firebaseService.verifyIdToken(idToken);
    const { uid: firebaseUid, email, name, picture } = decodedToken;

    if (!email) {
      throw new AppError(400, 'Social account must have an email address');
    }

    // 2. Find or create user
    let user = await this.prisma.client.user.findFirst({
      where: {
        OR: [{ firebaseUid }, { email }],
      },
    });

    if (user) {
      // 2a. Update existing user
      user = await this.prisma.client.user.update({
        where: { id: user.id },
        data: {
          firebaseUid: user.firebaseUid ? undefined : firebaseUid, // Link if not linked
          isVerified: true, // Social login implies verified email
          profilePictureURL: user.profilePictureURL || picture,
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
          fcmTokens: dto.fcmToken
            ? this.utils.addFcmToken(user.fcmTokens, dto.fcmToken)
            : user.fcmTokens,
        },
      });
    } else {
      // 2b. Create new user
      const username = await this.utils.generateUniqueUsername(name || 'user');
      user = await this.prisma.client.user.create({
        data: {
          email,
          firebaseUid,
          name: name || 'Unnamed User',
          username,
          isVerified: true,
          profilePictureURL: picture,
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
          fcmTokens: dto?.fcmToken ? [dto.fcmToken] : [],
        },
      });
    }

    if (!user.email) {
      throw new AppError(500, 'User has no email');
    }

    // 3. Generate tokens
    const token = await this.utils.generateTokenPairAndSave({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return successResponse(
      {
        user: await this.utils.sanitizeUser(user),
        token,
      },
      'Logged in successfully',
    );
  }
}
