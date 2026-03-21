-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN "hltv_event_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_hltv_event_id_key" ON "tournaments"("hltv_event_id");
