-- Additive: one version can only hold one row per page number.
--
-- Indexing (lib/sop-content/index-service.js) is delete-then-create in one
-- transaction, which is idempotent for sequential runs -- but two runs for
-- the SAME version executing concurrently (e.g. the Repository backfill
-- button clicked twice before the worker finishes the first batch) could
-- interleave under READ COMMITTED such that neither delete sees the other's
-- uncommitted inserts and both commit, doubling every page. This constraint
-- makes that physically impossible: the second concurrent transaction
-- conflicts and aborts, leaving exactly one clean set of pages.

CREATE UNIQUE INDEX "SopSection_sopVersionId_pageNumber_key" ON "SopSection"("sopVersionId", "pageNumber");
