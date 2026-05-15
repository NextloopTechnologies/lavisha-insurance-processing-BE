/*
  Warnings:

  - You are about to drop the column `rateListFileName` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "rateListFileName",
ADD COLUMN     "rateListFileNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
