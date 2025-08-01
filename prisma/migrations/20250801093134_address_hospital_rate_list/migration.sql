-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "queryId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "profileFileName" TEXT,
ADD COLUMN     "profileUrl" TEXT,
ADD COLUMN     "rateListFileName" TEXT,
ADD COLUMN     "rateListUrl" TEXT;

-- CreateTable
CREATE TABLE "Query" (
    "id" TEXT NOT NULL,
    "insuranceRequestId" TEXT NOT NULL,
    "enhancementId" TEXT,
    "notes" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Query_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Query" ADD CONSTRAINT "Query_insuranceRequestId_fkey" FOREIGN KEY ("insuranceRequestId") REFERENCES "InsuranceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Query" ADD CONSTRAINT "Query_enhancementId_fkey" FOREIGN KEY ("enhancementId") REFERENCES "Enhancement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
