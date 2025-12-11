/*
  Warnings:

  - A unique constraint covering the columns `[googlePlaceId]` on the table `venues` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "googlePlaceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "venues_googlePlaceId_key" ON "venues"("googlePlaceId");
