-- AlterTable
ALTER TABLE "InsuranceRequest" ADD COLUMN     "deduction" TEXT,
ADD COLUMN     "settlementDate" TIMESTAMP(3),
ADD COLUMN     "tds" TEXT,
ADD COLUMN     "totalApproval" TEXT,
ADD COLUMN     "totalBill" TEXT,
ADD COLUMN     "transactionId" TEXT,
ADD COLUMN     "updatedDate" TIMESTAMP(3);
