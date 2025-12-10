import { ENVEnum } from '@/common/enum/env.enum';
import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthGuestService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @HandleError('Guest login failed')
  async guestLogin() {
    const guestId = `guest-${uuidv4()}`;
    const now = new Date();

    // Generate a guest JWT token (shorter expiry for guests)
    const payload = {
      sub: guestId,
      email: null,
      role: 'GUEST',
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow(ENVEnum.JWT_SECRET),
      expiresIn: '7d', // Guest tokens expire in 7 days
    });

    // Build guest user profile with default values
    const guestUser = {
      id: guestId,
      name: 'Guest User',
      email: null,
      username: null,
      role: 'GUEST',
      status: 'ACTIVE',
      isVerified: false,
      lastLoginAt: now,
      lastActiveAt: now,
      profilePictureId: null,
      profilePictureUrl: null,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
      notifications: [],
      levelAnalytics: {
        currentLevel: 1,
        levelLabel: 'Beginner',
        pointsInCurrentLevel: 0,
        pointsNeededForLevel: 10,
        pointsRemaining: 10,
        totalPoints: 0,
        progressPercentage: 0,
      },
    };

    return successResponse(
      {
        user: guestUser,
        token: {
          accessToken,
          refreshToken: null,
          refreshTokenExpiresAt: null,
        },
      },
      'Guest login successful',
    );
  }
}
