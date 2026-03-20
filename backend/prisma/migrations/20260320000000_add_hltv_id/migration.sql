-- AlterTable
ALTER TABLE "events" ADD COLUMN "hltv_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "events_hltv_id_key" ON "events"("hltv_id");
