/*
  Warnings:

  - Added the required column `hospitalUserId` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "hospitalUserId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_hospitalUserId_fkey" FOREIGN KEY ("hospitalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
