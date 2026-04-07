-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "hltv_event_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tournaments_hltv_event_id_key" ON "tournaments"("hltv_event_id");
