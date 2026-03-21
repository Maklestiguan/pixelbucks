-- DropIndex
DROP INDEX IF EXISTS "tournaments_hltv_event_id_key";

-- CreateIndex (non-unique, for lookups)
CREATE INDEX "tournaments_hltv_event_id_idx" ON "tournaments"("hltv_event_id");
