-- Additive: adds SopSection, one row per extracted PDF page of an approved
-- SOP version, searched by the AI Copilot chatbot
-- (lib/ai/chat/retrievers/sop-content.js). No existing table or row changes.
--
-- searchVector is a generated tsvector column added via raw SQL because
-- Prisma cannot model the `tsvector` type directly -- same approach already
-- used for pgvector (see 20260803000000_enable_pgvector). The 'simple' text
-- search config is used (token-based, no stemming) rather than 'english',
-- since this content is Indonesian/English regulatory text and an English
-- stemmer would silently mis-stem Indonesian words.

CREATE TABLE "SopSection" (
    "id" TEXT NOT NULL,
    "sopVersionId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SopSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SopSection_sopVersionId_idx" ON "SopSection"("sopVersionId");

ALTER TABLE "SopSection" ADD CONSTRAINT "SopSection_sopVersionId_fkey" FOREIGN KEY ("sopVersionId") REFERENCES "SopVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SopSection" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', "text")) STORED;

CREATE INDEX "SopSection_searchVector_idx" ON "SopSection" USING GIN ("searchVector");
