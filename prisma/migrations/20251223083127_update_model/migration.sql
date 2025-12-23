/*
  Warnings:

  - You are about to drop the column `adShowRangeInKm` on the `advertisements` table. All the data in the column will be lost.
  - Added the required column `adShowRangeInMiles` to the `advertisements` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "advertisements" DROP COLUMN "adShowRangeInKm",
ADD COLUMN     "adShowRangeInMiles" INTEGER NOT NULL;
