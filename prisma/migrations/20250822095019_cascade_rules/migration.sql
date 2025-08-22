-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_insuranceRequestId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_uploadedBy_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "hospitalId" TEXT,
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "createdBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "uploadedBy" DROP NOT NULL,
ALTER COLUMN "insuranceRequestId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hospitalId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_insuranceRequestId_fkey" FOREIGN KEY ("insuranceRequestId") REFERENCES "InsuranceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
