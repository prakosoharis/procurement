-- Repository taxonomy update:
-- - M6 Code of Conduct is removed from the mandatory compliance catalogue.
-- - Value Creation becomes M7.
-- - all former additional types are retained as documents under one OTHER /
--   Additional type, so no existing document or Drive file reference is lost.
-- - one Business Unit can hold several documents under the same type as long
--   as their document titles differ.

BEGIN;

CREATE TEMP TABLE "RepositoryDocumentTypeLegacy" ON COMMIT DROP AS
SELECT "id", "code", "name", "category"
FROM "DocumentType"
WHERE "category" = 'ADDITIONAL'
   OR "code" IN ('M6', 'M7')
   OR lower("name") IN ('value creation', 'additional');

DROP INDEX IF EXISTS "GoogleDriveUploadSession_one_active_document_key";

-- Free the unique code and name values before creating the two controlled
-- replacement rows. IDs stay in the temporary mapping until every reference
-- has been moved.
UPDATE "DocumentType" AS "type"
SET "code" = '__repository_legacy__' || "type"."id",
    "name" = '__repository_legacy__' || "type"."id"
FROM "RepositoryDocumentTypeLegacy" AS "legacy"
WHERE "type"."id" = "legacy"."id";

INSERT INTO "DocumentType" ("id", "code", "name", "category", "sortOrder", "createdAt")
VALUES
  ('repository_document_type_m7_value_creation', 'M7', 'Value Creation', 'MANDATORY', 7, CURRENT_TIMESTAMP),
  ('repository_document_type_other_additional', 'OTHER', 'Additional', 'ADDITIONAL', 100, CURRENT_TIMESTAMP);

-- Existing Value Creation rows keep their document records and become M7.
-- Code of Conduct and every previous additional type become named documents
-- under the single Additional classification.
UPDATE "SopDocument" AS "document"
SET "documentTypeId" = CASE
  WHEN "legacy"."code" IN ('M7', 'A9') OR lower("legacy"."name") = 'value creation'
    THEN 'repository_document_type_m7_value_creation'
  ELSE 'repository_document_type_other_additional'
END
FROM "RepositoryDocumentTypeLegacy" AS "legacy"
WHERE "document"."documentTypeId" = "legacy"."id";

UPDATE "GoogleDriveUploadSession" AS "session"
SET "documentTypeId" = CASE
  WHEN "legacy"."code" IN ('M7', 'A9') OR lower("legacy"."name") = 'value creation'
    THEN 'repository_document_type_m7_value_creation'
  ELSE 'repository_document_type_other_additional'
END
FROM "RepositoryDocumentTypeLegacy" AS "legacy"
WHERE "session"."documentTypeId" = "legacy"."id";

DELETE FROM "DocumentType" AS "type"
USING "RepositoryDocumentTypeLegacy" AS "legacy"
WHERE "type"."id" = "legacy"."id";

CREATE UNIQUE INDEX "GoogleDriveUploadSession_one_active_document_key"
  ON "GoogleDriveUploadSession"("businessUnitId", "documentTypeId", "title")
  WHERE "purpose" = 'CREATE_DOCUMENT' AND "status" IN ('PENDING', 'UPLOADED', 'TRANSFERRING', 'FINALIZING');

COMMIT;
