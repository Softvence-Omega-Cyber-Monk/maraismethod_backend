/*
  Warnings:

  - You are about to drop the column `closeTime` on the `venues` table. All the data in the column will be lost.
  - You are about to drop the column `openTime` on the `venues` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "venues" DROP COLUMN "closeTime",
DROP COLUMN "openTime",
ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "startTime" TEXT;
