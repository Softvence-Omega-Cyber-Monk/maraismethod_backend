import { successResponse, TResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthGetProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authUtils: AuthUtilsService,
  ) {}

  @HandleError("Can't get user profile")
  async getProfile(userId: string) {
    const profileResponse = await this.findUserBy('id', userId);
    const user = profileResponse.data;

    // Fetch total points from votes
    const totalPoints = await this.prisma.client.votes.count({
      where: { userId, isOpen: true }, // counting only open votes
    });

    // Define levels with labels
    const LEVELS = [
      { level: 1, minPoints: 0, maxPoints: 10, label: 'Beginner' },
      { level: 2, minPoints: 11, maxPoints: 25, label: 'Intermediate' },
      { level: 3, minPoints: 26, maxPoints: 50, label: 'Advanced' },
      { level: 4, minPoints: 51, maxPoints: 100, label: 'Expert' },
    ];

    // Determine current level (default to first level if no points)
    const currentLevel =
      LEVELS.find(
        (lvl) => totalPoints >= lvl.minPoints && totalPoints <= lvl.maxPoints,
      ) || LEVELS[0];

    // Points calculations
    const pointsInCurrentLevel = Math.max(
      totalPoints - currentLevel.minPoints,
      0,
    );
    const pointsNeededForLevel =
      currentLevel.maxPoints - currentLevel.minPoints;
    const pointsRemaining = Math.max(currentLevel.maxPoints - totalPoints, 0);
    const progressPercentage =
      pointsNeededForLevel > 0
        ? Math.floor((pointsInCurrentLevel / pointsNeededForLevel) * 100)
        : 100;

    // Attach level analytics to user
    const dataWithLevel = {
      ...user,
      levelAnalytics: {
        currentLevel: currentLevel.level,
        levelLabel: currentLevel.label,
        pointsInCurrentLevel,
        pointsNeededForLevel,
        pointsRemaining,
        totalPoints,
        progressPercentage,
      },
    };

    return successResponse(dataWithLevel, 'User data fetched successfully');
  }

  private async findUserBy(
    key: 'id' | 'email',
    value: string,
  ): Promise<TResponse<any>> {
    const where: any = {};
    where[key] = value;

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where,
      include: {
        notifications: true,
      },
    });

    // Extract only the main user fields
    const { notifications, ...mainUser } = user;

    const sanitizedUser = await this.authUtils.sanitizeUser(mainUser);

    // Rebuild the full object: sanitized user + full raw relations
    const data = {
      ...sanitizedUser,
      notifications,
    };

    return successResponse(data, 'User data fetched successfully');
  }
}
