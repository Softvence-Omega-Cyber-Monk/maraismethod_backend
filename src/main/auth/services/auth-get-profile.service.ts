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

  // -------------------------------
  // LEVEL SYSTEM HELPERS
  // -------------------------------

  /** XP required for a given level */
  private calculateXpForLevel(level: number): number {
    return 10 * level * level; // XP curve formula
  }

  /** Determine level from total points */
  private getLevelFromPoints(totalPoints: number): number {
    let level = 1;

    while (totalPoints >= this.calculateXpForLevel(level)) {
      level++;
    }

    return level - 1; // last valid level
  }

  /** Level labels (auto fallbacks after 8) */
  private getLevelLabel(level: number): string {
    const labels = [
      'Beginner', // 1
      'Bronze', // 2
      'Silver', // 3
      'Gold', // 4
      'Diamond', // 5
      'Master', // 6
      'Grandmaster', // 7
      'Legend', // 8
    ];

    return labels[level - 1] || `Level ${level}`;
  }

  // -------------------------------
  // MAIN PROFILE SERVICE
  // -------------------------------

  @HandleError("Can't get user profile")
  async getProfile(userId: string) {
    const profileResponse = await this.findUserBy('id', userId);
    const user = profileResponse.data;

    // Fetch vote points (each vote = 1 point)
    const totalPoints = await this.prisma.client.votes.count({
      where: { userId },
    });

    // Determine levels
    const currentLevel = this.getLevelFromPoints(totalPoints);
    const nextLevel = currentLevel + 1;

    // XP requirements
    const currentLevelXP = this.calculateXpForLevel(currentLevel);
    const nextLevelXP = this.calculateXpForLevel(nextLevel);

    // Progress analytics
    const pointsInCurrentLevel = totalPoints - currentLevelXP;
    const pointsNeededForLevel = nextLevelXP - currentLevelXP;
    const pointsRemaining = Math.max(nextLevelXP - totalPoints, 0);
    const progressPercentage =
      pointsNeededForLevel > 0
        ? Math.floor((pointsInCurrentLevel / pointsNeededForLevel) * 100)
        : 100;

    // Build response payload
    const dataWithLevel = {
      ...user,
      levelAnalytics: {
        currentLevel,
        levelLabel: this.getLevelLabel(currentLevel),

        totalPoints,

        nextLevel,
        nextLevelLabel: this.getLevelLabel(nextLevel),

        pointsInCurrentLevel,
        pointsNeededForLevel,
        pointsRemaining,
        progressPercentage,
      },
    };

    return successResponse(dataWithLevel, 'User data fetched successfully');
  }

  // -------------------------------
  // Helper — Find User
  // -------------------------------

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
        profilePicture: true,
      },
    });

    // Sanitized + relational structure
    const { notifications, ...mainUser } = user;
    const sanitizedUser = await this.authUtils.sanitizeUser(mainUser);

    const data = {
      ...sanitizedUser,
      notifications,
    };

    return successResponse(data, 'User data fetched successfully');
  }
}
