-- AlterTable
ALTER TABLE "user_challenges" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
