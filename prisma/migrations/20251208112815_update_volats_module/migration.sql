-- DropIndex
DROP INDEX "votes_userId_venueId_key";

-- CreateIndex
CREATE INDEX "votes_venueId_createdAt_idx" ON "votes"("venueId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "votes_userId_venueId_createdAt_idx" ON "votes"("userId", "venueId", "createdAt" DESC);
