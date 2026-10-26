/*
  Warnings:

  - A unique constraint covering the columns `[emailMessageId]` on the table `chat_sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'EMAIL';

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "emailMessageId" TEXT,
ADD COLUMN     "emailSujet" TEXT,
ADD COLUMN     "source" "LeadSource" NOT NULL DEFAULT 'CHATBOT';

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_emailMessageId_key" ON "chat_sessions"("emailMessageId");

-- CreateIndex
CREATE INDEX "chat_sessions_companyId_source_idx" ON "chat_sessions"("companyId", "source");
