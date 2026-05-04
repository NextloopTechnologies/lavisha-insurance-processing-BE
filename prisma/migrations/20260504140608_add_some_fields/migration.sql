-- AlterTable
ALTER TABLE "InsuranceRequest" ADD COLUMN     "dateOfAdmission" TIMESTAMP(3),
ADD COLUMN     "dateOfDischarge" TIMESTAMP(3),
ADD COLUMN     "diagnosis" TEXT,
ADD COLUMN     "provisionalAmount" TEXT;
