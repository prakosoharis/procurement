-- People structures may be owned by exactly one Business Unit or one
-- Organization Group. Existing structures and positions remain BU-scoped.
CREATE TYPE "OrganizationStructureScope" AS ENUM ('BUSINESS_UNIT', 'GROUP');

ALTER TABLE "OrganizationStructure"
  ADD COLUMN "scopeType" "OrganizationStructureScope" NOT NULL DEFAULT 'BUSINESS_UNIT',
  ADD COLUMN "organizationGroupId" TEXT,
  ALTER COLUMN "businessUnitId" DROP NOT NULL;

ALTER TABLE "OrganizationPosition"
  ADD COLUMN "organizationGroupId" TEXT,
  ALTER COLUMN "businessUnitId" DROP NOT NULL;

ALTER TABLE "Person"
  ADD COLUMN "firstWorkStartedAt" TIMESTAMP(3);

DROP INDEX "OrganizationStructure_one_active_per_business_unit_key";

CREATE UNIQUE INDEX "OrganizationStructure_one_active_per_business_unit_key"
  ON "OrganizationStructure"("businessUnitId")
  WHERE "status" = 'ACTIVE' AND "scopeType" = 'BUSINESS_UNIT';

CREATE UNIQUE INDEX "OrganizationStructure_one_active_per_group_key"
  ON "OrganizationStructure"("organizationGroupId")
  WHERE "status" = 'ACTIVE' AND "scopeType" = 'GROUP';

CREATE UNIQUE INDEX "OrganizationPosition_organizationGroupId_code_key"
  ON "OrganizationPosition"("organizationGroupId", "code")
  WHERE "organizationGroupId" IS NOT NULL AND "code" IS NOT NULL;

CREATE INDEX "OrganizationStructure_organizationGroupId_status_idx"
  ON "OrganizationStructure"("organizationGroupId", "status");

CREATE INDEX "OrganizationPosition_organizationGroupId_status_idx"
  ON "OrganizationPosition"("organizationGroupId", "status");

ALTER TABLE "OrganizationStructure"
  ADD CONSTRAINT "OrganizationStructure_scope_target_check"
  CHECK (
    ("scopeType" = 'BUSINESS_UNIT' AND "businessUnitId" IS NOT NULL AND "organizationGroupId" IS NULL)
    OR
    ("scopeType" = 'GROUP' AND "organizationGroupId" IS NOT NULL AND "businessUnitId" IS NULL)
  );

ALTER TABLE "OrganizationPosition"
  ADD CONSTRAINT "OrganizationPosition_scope_target_check"
  CHECK (
    ("businessUnitId" IS NOT NULL AND "organizationGroupId" IS NULL)
    OR
    ("businessUnitId" IS NULL AND "organizationGroupId" IS NOT NULL)
  );

ALTER TABLE "OrganizationStructure"
  ADD CONSTRAINT "OrganizationStructure_organizationGroupId_fkey"
  FOREIGN KEY ("organizationGroupId") REFERENCES "OrganizationGroup"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationPosition"
  ADD CONSTRAINT "OrganizationPosition_organizationGroupId_fkey"
  FOREIGN KEY ("organizationGroupId") REFERENCES "OrganizationGroup"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
