import { ENVEnum } from '@/common/enum/env.enum';
import { AppError } from '@/core/error/handle-error.app';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private logger = new Logger(FirebaseService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.configService.getOrThrow<string>(
            ENVEnum.FIREBASE_PROJECT_ID,
          ),
          clientEmail: this.configService.getOrThrow<string>(
            ENVEnum.FIREBASE_CLIENT_EMAIL,
          ),
          privateKey: this.configService
            .getOrThrow<string>(ENVEnum.FIREBASE_PRIVATE_KEY)
            ?.replace(/\\n/g, '\n'),
        } as admin.ServiceAccount),
        projectId: this.configService.getOrThrow<string>(
          ENVEnum.FIREBASE_PROJECT_ID,
        ),
      });

      this.logger.log('Firebase initialized');
    } else {
      this.logger.log('Firebase already initialized');
    }
  }

  /** Verify Firebase ID token (Google signup/login) */
  async verifyIdToken(idToken: string) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return decodedToken;
    } catch (err) {
      this.logger.error('Firebase ID token verification error:', err);
      throw new AppError(401, 'Invalid Firebase ID token');
    }
  }

  /** Send push notification via FCM */
  async sendPushNotification(
    fcmTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!fcmTokens || fcmTokens.length === 0) {
      this.logger.error('No FCM tokens provided');
      throw new AppError(400, 'No FCM tokens provided');
    }
    this.logger.log('Sending push notification...');

    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: { title, body },
      data,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);

      this.logger.log(
        `[FCM] Broadcast sent: ${response.successCount} succeeded, ${response.failureCount} failed.`,
      );

      if (response.failureCount > 0) {
        const failedTokens = response.responses
          .map((res, i) => (!res.success ? fcmTokens[i] : null))
          .filter(Boolean);

        this.logger.error(`[FCM] Failed tokens: ${failedTokens.join(', ')}`);
      }

      return response;
    } catch (err) {
      this.logger.error('Firebase push notification error:', err);
      throw new AppError(500, 'Failed to send push notification');
    }
  }

  /** Get Firebase Messaging instance */
  async getMessaging() {
    return admin.messaging();
  }
}
