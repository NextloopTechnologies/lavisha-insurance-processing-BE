/*
  Warnings:

  - Added the required column `numberOfDays` to the `Enhancement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "enhancementId" TEXT;

-- AlterTable
ALTER TABLE "Enhancement" ADD COLUMN     "dischargeSummary" TEXT,
ADD COLUMN     "doctorName" TEXT,
ADD COLUMN     "numberOfDays" INTEGER NOT NULL,
ADD COLUMN     "settlementSummary" TEXT;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_enhancementId_fkey" FOREIGN KEY ("enhancementId") REFERENCES "Enhancement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
