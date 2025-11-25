-- AlterTable
ALTER TABLE "Query" ADD COLUMN     "isResolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resolvedRemarks" TEXT;
