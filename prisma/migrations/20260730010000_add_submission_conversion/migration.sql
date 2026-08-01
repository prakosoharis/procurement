-- CreateEnum
CREATE TYPE "SubmissionConversionMode" AS ENUM ('CREATE_SOP', 'CREATE_REVISION');

-- AlterTable
ALTER TABLE "SopRequest"
  ADD COLUMN "conversionIntent" "SubmissionConversionMode",
  ADD COLUMN "requestedBusinessUnitId" TEXT;

-- CreateTable
CREATE TABLE "SubmissionConversion" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "mode" "SubmissionConversionMode" NOT NULL,
  "sopDocumentId" TEXT NOT NULL,
  "sopVersionId" TEXT NOT NULL,
  "sourceVersionId" TEXT,
  "convertedById" TEXT NOT NULL,
  "convertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubmissionConversion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SopRequest_requestedBusinessUnitId_idx" ON "SopRequest"("requestedBusinessUnitId");
CREATE UNIQUE INDEX "SubmissionConversion_requestId_key" ON "SubmissionConversion"("requestId");
CREATE UNIQUE INDEX "SubmissionConversion_sopVersionId_key" ON "SubmissionConversion"("sopVersionId");
CREATE INDEX "SubmissionConversion_sopDocumentId_idx" ON "SubmissionConversion"("sopDocumentId");
CREATE INDEX "SubmissionConversion_sourceVersionId_idx" ON "SubmissionConversion"("sourceVersionId");
CREATE INDEX "SubmissionConversion_convertedById_idx" ON "SubmissionConversion"("convertedById");

-- AddForeignKey
ALTER TABLE "SopRequest"
  ADD CONSTRAINT "SopRequest_requestedBusinessUnitId_fkey"
  FOREIGN KEY ("requestedBusinessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubmissionConversion"
  ADD CONSTRAINT "SubmissionConversion_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "SopRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SubmissionConversion_sopDocumentId_fkey"
  FOREIGN KEY ("sopDocumentId") REFERENCES "SopDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SubmissionConversion_sopVersionId_fkey"
  FOREIGN KEY ("sopVersionId") REFERENCES "SopVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SubmissionConversion_sourceVersionId_fkey"
  FOREIGN KEY ("sourceVersionId") REFERENCES "SopVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SubmissionConversion_convertedById_fkey"
  FOREIGN KEY ("convertedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
