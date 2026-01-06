-- CreateEnum
CREATE TYPE "VenueSource" AS ENUM ('google', 'database');

-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "source" "VenueSource" NOT NULL DEFAULT 'database';
