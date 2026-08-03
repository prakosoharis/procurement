-- People & Organization Structure foundation. All tables are additive and do
-- not modify existing Business Unit, User, or governance records.
CREATE TYPE "OrganizationStructureStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "OrganizationPositionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "PositionAssignmentType" AS ENUM ('PERMANENT', 'ACTING');

CREATE TABLE "OrganizationStructure" (
  "id" TEXT NOT NULL,
  "businessUnitId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "effectiveDate" TIMESTAMP(3),
  "status" "OrganizationStructureStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationStructure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationPosition" (
  "id" TEXT NOT NULL,
  "structureId" TEXT NOT NULL,
  "businessUnitId" TEXT NOT NULL,
  "parentId" TEXT,
  "title" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "OrganizationPositionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationPosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Person" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "employeeIdentifier" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "photoUrl" TEXT,
  "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PersonEducation" (
  "id" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "institution" TEXT NOT NULL,
  "degreeLevel" TEXT NOT NULL,
  "fieldOfStudy" TEXT,
  "startYear" INTEGER,
  "graduationYear" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PersonEducation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PersonCertification" (
  "id" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "credentialId" TEXT,
  "issueDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "evidenceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PersonCertification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PositionAssignment" (
  "id" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "type" "PositionAssignmentType" NOT NULL DEFAULT 'PERMANENT',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PositionAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationStructure_businessUnitId_status_idx" ON "OrganizationStructure"("businessUnitId", "status");
CREATE INDEX "OrganizationPosition_structureId_parentId_status_displayOrd_idx" ON "OrganizationPosition"("structureId", "parentId", "status", "displayOrder");
CREATE INDEX "OrganizationPosition_businessUnitId_status_idx" ON "OrganizationPosition"("businessUnitId", "status");
CREATE UNIQUE INDEX "OrganizationPosition_businessUnitId_code_key" ON "OrganizationPosition"("businessUnitId", "code");
CREATE UNIQUE INDEX "Person_employeeIdentifier_key" ON "Person"("employeeIdentifier");
CREATE INDEX "Person_fullName_idx" ON "Person"("fullName");
CREATE INDEX "Person_status_idx" ON "Person"("status");
CREATE INDEX "PersonEducation_personId_idx" ON "PersonEducation"("personId");
CREATE INDEX "PersonCertification_personId_idx" ON "PersonCertification"("personId");
CREATE INDEX "PersonCertification_expiryDate_idx" ON "PersonCertification"("expiryDate");
CREATE INDEX "PositionAssignment_positionId_endDate_idx" ON "PositionAssignment"("positionId", "endDate");
CREATE INDEX "PositionAssignment_personId_endDate_idx" ON "PositionAssignment"("personId", "endDate");
CREATE UNIQUE INDEX "PositionAssignment_personId_positionId_startDate_key" ON "PositionAssignment"("personId", "positionId", "startDate");

ALTER TABLE "OrganizationStructure" ADD CONSTRAINT "OrganizationStructure_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationPosition" ADD CONSTRAINT "OrganizationPosition_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "OrganizationStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationPosition" ADD CONSTRAINT "OrganizationPosition_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationPosition" ADD CONSTRAINT "OrganizationPosition_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrganizationPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PersonEducation" ADD CONSTRAINT "PersonEducation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PersonCertification" ADD CONSTRAINT "PersonCertification_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PositionAssignment" ADD CONSTRAINT "PositionAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "OrganizationPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PositionAssignment" ADD CONSTRAINT "PositionAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
