/*
  Warnings:

  - You are about to drop the column `updatedDate` on the `InsuranceRequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "InsuranceRequest" DROP COLUMN "updatedDate",
ADD COLUMN     "updatedSettlementDate" TIMESTAMP(3);
