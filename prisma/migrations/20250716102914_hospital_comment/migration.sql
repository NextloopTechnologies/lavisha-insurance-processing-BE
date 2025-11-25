/*
  Warnings:

  - Added the required column `insuranceCompany` to the `InsuranceRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "CommentType" ADD VALUE 'HOSPITAL_NOTE';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'HOSPITAL_MANAGER';

-- AlterTable
ALTER TABLE "InsuranceRequest" ADD COLUMN     "insuranceCompany" TEXT NOT NULL,
ADD COLUMN     "isPreAuth" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "url" TEXT;
