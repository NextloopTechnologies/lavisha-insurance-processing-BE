-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_hospitalUserId_fkey";

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "hospitalUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_hospitalUserId_fkey" FOREIGN KEY ("hospitalUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
