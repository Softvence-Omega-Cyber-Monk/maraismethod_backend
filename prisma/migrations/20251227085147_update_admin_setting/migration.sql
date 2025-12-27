-- AlterTable
ALTER TABLE "admin_settings" ADD COLUMN     "shouldValidateLocation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shouldValidateTime" BOOLEAN NOT NULL DEFAULT false;
