-- AlterTable
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "hltv_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "events_hltv_id_key" ON "events"("hltv_id");
