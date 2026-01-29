-- AlterTable
ALTER TABLE "usage_logs" ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "success" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "usage_logs_api_key_id_createdAt_idx" ON "usage_logs"("api_key_id", "createdAt");

-- CreateIndex
CREATE INDEX "usage_logs_user_id_createdAt_idx" ON "usage_logs"("user_id", "createdAt");
