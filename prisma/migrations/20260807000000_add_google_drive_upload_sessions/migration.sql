CREATE TYPE "GoogleDriveUploadPurpose" AS ENUM ('CREATE_DOCUMENT', 'CREATE_VERSION');
CREATE TYPE "GoogleDriveUploadStatus" AS ENUM ('PENDING', 'FINALIZING', 'COMPLETED', 'FAILED', 'EXPIRED');

CREATE TABLE "GoogleDriveUploadSession" (
  "id" TEXT NOT NULL,
  "purpose" "GoogleDriveUploadPurpose" NOT NULL,
  "status" "GoogleDriveUploadStatus" NOT NULL DEFAULT 'PENDING',
  "businessUnitId" TEXT NOT NULL,
  "sopDocumentId" TEXT,
  "documentTypeId" TEXT,
  "ownerId" TEXT,
  "reviewerId" TEXT NOT NULL,
  "title" TEXT,
  "language" TEXT,
  "versionNo" TEXT NOT NULL,
  "expectedFileName" TEXT NOT NULL,
  "expectedDriveName" TEXT NOT NULL,
  "expectedFileSize" INTEGER NOT NULL,
  "contentType" TEXT NOT NULL,
  "googleDriveParentId" TEXT NOT NULL,
  "changeSummary" TEXT,
  "createdById" TEXT NOT NULL,
  "googleDriveFileId" TEXT,
  "sopVersionId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoogleDriveUploadSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleDriveUploadSession_googleDriveFileId_key"
  ON "GoogleDriveUploadSession"("googleDriveFileId");
CREATE UNIQUE INDEX "GoogleDriveUploadSession_sopVersionId_key"
  ON "GoogleDriveUploadSession"("sopVersionId");
CREATE INDEX "GoogleDriveUploadSession_status_expiresAt_idx"
  ON "GoogleDriveUploadSession"("status", "expiresAt");
CREATE INDEX "GoogleDriveUploadSession_businessUnitId_status_idx"
  ON "GoogleDriveUploadSession"("businessUnitId", "status");
CREATE INDEX "GoogleDriveUploadSession_sopDocumentId_status_idx"
  ON "GoogleDriveUploadSession"("sopDocumentId", "status");
CREATE INDEX "GoogleDriveUploadSession_createdById_status_idx"
  ON "GoogleDriveUploadSession"("createdById", "status");

CREATE UNIQUE INDEX "GoogleDriveUploadSession_one_pending_document_key"
  ON "GoogleDriveUploadSession"("businessUnitId", "documentTypeId")
  WHERE "purpose" = 'CREATE_DOCUMENT' AND "status" = 'PENDING';

CREATE UNIQUE INDEX "GoogleDriveUploadSession_one_pending_version_key"
  ON "GoogleDriveUploadSession"("sopDocumentId")
  WHERE "purpose" = 'CREATE_VERSION' AND "status" = 'PENDING';
