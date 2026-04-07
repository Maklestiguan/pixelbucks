-- CreateTable
CREATE TABLE IF NOT EXISTS "balance_audits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "balance_audits_user_id_created_at_idx" ON "balance_audits"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "balance_audits_created_at_idx" ON "balance_audits"("created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "balance_audits_reason_idx" ON "balance_audits"("reason");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'balance_audits_user_id_fkey'
  ) THEN
    ALTER TABLE "balance_audits" ADD CONSTRAINT "balance_audits_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
