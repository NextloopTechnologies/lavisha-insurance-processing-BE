-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokens" TEXT[] DEFAULT ARRAY[]::TEXT[];
