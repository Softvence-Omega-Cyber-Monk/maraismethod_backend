/*
  Warnings:

  - You are about to drop the column `closedDays` on the `venues` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `venues` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `venues` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "venues" DROP COLUMN "closedDays",
DROP COLUMN "endTime",
DROP COLUMN "startTime";

-- CreateTable
CREATE TABLE "operating_hours" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,

    CONSTRAINT "operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operating_hours_venueId_day_key" ON "operating_hours"("venueId", "day");

-- AddForeignKey
ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
