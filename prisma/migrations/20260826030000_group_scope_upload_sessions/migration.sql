-- Additive: an upload session carries the eventual document's scope, since
-- the SopDocument row is only created once the transfer worker finishes.
-- Existing sessions keep businessUnitId and default to BUSINESS_UNIT.

ALTER TABLE "GoogleDriveUploadSession" ADD COLUMN "scopeType" "SopDocumentScope" NOT NULL DEFAULT 'BUSINESS_UNIT';
ALTER TABLE "GoogleDriveUploadSession" ADD COLUMN "organizationGroupId" TEXT;
ALTER TABLE "GoogleDriveUploadSession" ALTER COLUMN "businessUnitId" DROP NOT NULL;

ALTER TABLE "GoogleDriveUploadSession" ADD CONSTRAINT "GoogleDriveUploadSession_scope_owner_check" CHECK (
  ("scopeType" = 'BUSINESS_UNIT' AND "businessUnitId" IS NOT NULL AND "organizationGroupId" IS NULL)
  OR
  ("scopeType" = 'GROUP' AND "organizationGroupId" IS NOT NULL AND "businessUnitId" IS NULL)
);

-- The "one active CREATE_DOCUMENT upload per (owner, type, title)" lock has
-- to cover Group sessions too, otherwise two managers could start the same
-- Group document at once. A partial index over businessUnitId cannot see
-- Group rows (the column is NULL there), so the lock is split per scope.
DROP INDEX IF EXISTS "GoogleDriveUploadSession_one_active_document_key";

CREATE UNIQUE INDEX "GoogleDriveUploadSession_one_active_bu_document_key"
  ON "GoogleDriveUploadSession"("businessUnitId", "documentTypeId", "title")
  WHERE "purpose" = 'CREATE_DOCUMENT' AND "businessUnitId" IS NOT NULL
    AND "status" IN ('PENDING', 'UPLOADED', 'TRANSFERRING', 'FINALIZING');

CREATE UNIQUE INDEX "GoogleDriveUploadSession_one_active_group_document_key"
  ON "GoogleDriveUploadSession"("organizationGroupId", "documentTypeId", "title")
  WHERE "purpose" = 'CREATE_DOCUMENT' AND "organizationGroupId" IS NOT NULL
    AND "status" IN ('PENDING', 'UPLOADED', 'TRANSFERRING', 'FINALIZING');

CREATE INDEX "GoogleDriveUploadSession_organizationGroupId_status_idx" ON "GoogleDriveUploadSession"("organizationGroupId", "status");
