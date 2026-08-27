-- Additive: a template library. Tim Procurement uploads starting-point files;
-- a Business Unit downloads one, edits and gets it approved OUTSIDE the
-- application, then uploads the result as a Draft SOP through the existing
-- Repository flow. Nothing about existing documents changes.

CREATE TABLE "CompanySize" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanySize_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanySize_name_key" ON "CompanySize"("name");

-- Optional: the 11 existing Business Units have no size yet and keep working.
ALTER TABLE "BusinessUnit" ADD COLUMN "companySizeId" TEXT;
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_companySizeId_fkey"
  FOREIGN KEY ("companySizeId") REFERENCES "CompanySize"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    -- NULL means "applies to all", so one generic template need not be
    -- duplicated across every industry/size combination.
    "industryId" TEXT,
    "companySizeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "contentType" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentTemplate_documentTypeId_idx" ON "DocumentTemplate"("documentTypeId");

ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_documentTypeId_fkey"
  FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_industryId_fkey"
  FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_companySizeId_fkey"
  FOREIGN KEY ("companySizeId") REFERENCES "CompanySize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One template per combination, so a downloader always gets one unambiguous
-- answer. A plain UNIQUE(documentTypeId, industryId, companySizeId) would NOT
-- do this: in SQL, NULL is never equal to NULL, so two "all industries, all
-- sizes" rows for the same document type would both be accepted. COALESCE to
-- a sentinel makes the "applies to all" case compare as a real value.
CREATE UNIQUE INDEX "DocumentTemplate_scope_key"
  ON "DocumentTemplate"(
    "documentTypeId",
    COALESCE("industryId", '__all__'),
    COALESCE("companySizeId", '__all__')
  );
