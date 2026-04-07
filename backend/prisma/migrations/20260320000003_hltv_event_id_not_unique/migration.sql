-- DropIndex
DROP INDEX IF EXISTS "tournaments_hltv_event_id_key";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tournaments_hltv_event_id_idx" ON "tournaments"("hltv_event_id");
