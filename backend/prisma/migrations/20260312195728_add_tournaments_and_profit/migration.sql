-- AlterTable
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "tournament_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "total_profit" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "tournaments" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "tournaments_pandascore_id_key" ON "tournaments"("pandascore_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tournaments_tier_idx" ON "tournaments"("tier");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tournaments_game_idx" ON "tournaments"("game");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "events_tournament_id_idx" ON "events"("tournament_id");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_tournament_id_fkey') THEN
    ALTER TABLE "events" ADD CONSTRAINT "events_tournament_id_fkey"
      FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
