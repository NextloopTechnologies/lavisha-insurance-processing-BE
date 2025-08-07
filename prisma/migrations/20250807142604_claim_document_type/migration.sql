-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'DISCHARGE_OTHER';
ALTER TYPE "DocumentType" ADD VALUE 'SETTLEMENT_OTHER';

-- AlterTable
ALTER TABLE "InsuranceRequest" ADD COLUMN     "actualQuotedAmount" TEXT,
ADD COLUMN     "settlementAmount" TEXT;

-- AddForeignKey
ALTER TABLE "InsuranceRequest" ADD CONSTRAINT "InsuranceRequest_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
