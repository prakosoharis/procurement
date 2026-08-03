-- Prisma cannot express these partial uniqueness rules. They protect the MVP
-- invariant of one active structure per Business Unit and one active root per
-- active structure without rewriting the previously committed foundation migration.
CREATE UNIQUE INDEX "OrganizationStructure_one_active_per_business_unit_key"
  ON "OrganizationStructure"("businessUnitId")
  WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "OrganizationPosition_one_active_root_per_structure_key"
  ON "OrganizationPosition"("structureId")
  WHERE "parentId" IS NULL AND "status" = 'ACTIVE';
