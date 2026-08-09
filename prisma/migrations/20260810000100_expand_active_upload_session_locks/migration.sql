DROP INDEX IF EXISTS "GoogleDriveUploadSession_one_pending_document_key";
DROP INDEX IF EXISTS "GoogleDriveUploadSession_one_pending_version_key";

CREATE UNIQUE INDEX "GoogleDriveUploadSession_one_active_document_key"
  ON "GoogleDriveUploadSession"("businessUnitId", "documentTypeId")
  WHERE "purpose" = 'CREATE_DOCUMENT' AND "status" IN ('PENDING', 'UPLOADED', 'TRANSFERRING', 'FINALIZING');

CREATE UNIQUE INDEX "GoogleDriveUploadSession_one_active_version_key"
  ON "GoogleDriveUploadSession"("sopDocumentId")
  WHERE "purpose" = 'CREATE_VERSION' AND "status" IN ('PENDING', 'UPLOADED', 'TRANSFERRING', 'FINALIZING');
