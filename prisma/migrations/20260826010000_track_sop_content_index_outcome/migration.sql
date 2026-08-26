-- Additive: record the outcome of the last chatbot content-indexing attempt.
--
-- Without this, the Repository progress counter could only compute
-- "total - indexed" and had no way to distinguish a version still waiting for
-- its background job from one that can never be indexed (scanned PDF, DOCX).
-- A manager clicking the index button on 4 scanned PDFs saw the jobs report
-- success in Trigger.dev while the counter stayed put, with nothing on screen
-- explaining why.
--
-- Both columns null  = never attempted
-- contentIndexedAt   = searchable
-- contentIndexSkipReason = known format limitation; re-running will not help

ALTER TABLE "SopVersion" ADD COLUMN "contentIndexedAt" TIMESTAMP(3);
ALTER TABLE "SopVersion" ADD COLUMN "contentIndexSkipReason" TEXT;

-- Versions that already have extracted sections were indexed before this
-- column existed; mark them so they are not reported as "never attempted".
UPDATE "SopVersion" SET "contentIndexedAt" = NOW()
WHERE EXISTS (SELECT 1 FROM "SopSection" WHERE "SopSection"."sopVersionId" = "SopVersion"."id");
