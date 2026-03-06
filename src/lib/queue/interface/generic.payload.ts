import { User } from '@prisma/client';

export interface GenericPayload {
  adminId: string;
  message: string;
  admin: User;
}
