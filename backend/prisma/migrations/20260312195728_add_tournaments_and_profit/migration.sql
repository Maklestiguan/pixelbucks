-- AlterTable
ALTER TABLE "events" ADD COLUMN     "tournament_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "total_profit" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "pandascore_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_pandascore_id_key" ON "tournaments"("pandascore_id");

-- CreateIndex
CREATE INDEX "tournaments_tier_idx" ON "tournaments"("tier");

-- CreateIndex
CREATE INDEX "tournaments_game_idx" ON "tournaments"("game");

-- CreateIndex
CREATE INDEX "events_tournament_id_idx" ON "events"("tournament_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
