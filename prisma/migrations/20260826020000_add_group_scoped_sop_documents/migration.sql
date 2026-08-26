-- Additive: a SOP document can now be issued by an Organization Group
-- (holding) instead of a single Business Unit, mirroring the scopeType
-- pattern OrganizationStructure already uses for People.
--
-- Every existing row keeps businessUnitId and becomes BUSINESS_UNIT scope, so
-- no current document changes meaning. A Group document deliberately does NOT
-- satisfy a Business Unit's mandatory-document requirement -- the compliance
-- matrix stays strictly per-Business-Unit -- so no compliance figure moves as
-- a result of this migration.

CREATE TYPE "SopDocumentScope" AS ENUM ('BUSINESS_UNIT', 'GROUP');

ALTER TABLE "SopDocument" ADD COLUMN "scopeType" "SopDocumentScope" NOT NULL DEFAULT 'BUSINESS_UNIT';
ALTER TABLE "SopDocument" ADD COLUMN "organizationGroupId" TEXT;

-- businessUnitId becomes optional: a Group document has no single owning BU.
ALTER TABLE "SopDocument" ALTER COLUMN "businessUnitId" DROP NOT NULL;

ALTER TABLE "SopDocument" ADD CONSTRAINT "SopDocument_organizationGroupId_fkey"
  FOREIGN KEY ("organizationGroupId") REFERENCES "OrganizationGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exactly one owner, and it must match the declared scope. Enforced in the
-- database so no code path -- including a future Refinement or Request flow
-- that has not been written yet -- can leave a document owned by nobody or by
-- both at once.
ALTER TABLE "SopDocument" ADD CONSTRAINT "SopDocument_scope_owner_check" CHECK (
  ("scopeType" = 'BUSINESS_UNIT' AND "businessUnitId" IS NOT NULL AND "organizationGroupId" IS NULL)
  OR
  ("scopeType" = 'GROUP' AND "organizationGroupId" IS NOT NULL AND "businessUnitId" IS NULL)
);

CREATE INDEX "SopDocument_organizationGroupId_documentTypeId_idx" ON "SopDocument"("organizationGroupId", "documentTypeId");
