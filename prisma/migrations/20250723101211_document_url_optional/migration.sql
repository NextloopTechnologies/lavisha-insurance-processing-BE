-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_insuranceRequestId_fkey";

-- AlterTable
ALTER TABLE "Comment" ALTER COLUMN "insuranceRequestId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "url" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_insuranceRequestId_fkey" FOREIGN KEY ("insuranceRequestId") REFERENCES "InsuranceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
