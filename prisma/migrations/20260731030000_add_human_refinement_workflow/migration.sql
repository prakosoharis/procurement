CREATE TYPE "HumanRefinementFindingStatus" AS ENUM (
  'OPEN',
  'WAITING_FOR_CLARIFICATION',
  'RESOLVED',
  'DEFERRED',
  'DISMISSED'
);

CREATE TYPE "HumanRefinementFindingCategory" AS ENUM (
  'REGULATORY_MISMATCH',
  'INTERNAL_POLICY_CONFLICT',
  'PROCESS_GAP',
  'CONTROL_WEAKNESS',
  'AMBIGUOUS_WORDING',
  'DUPLICATE_OR_INCONSISTENT_RULE',
  'ROLE_AND_RESPONSIBILITY_ISSUE',
  'AUDIT_OR_FRAUD_RISK',
  'DOCUMENT_QUALITY',
  'OTHER'
);

CREATE TYPE "HumanRefinementSeverity" AS ENUM (
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'OBSERVATION'
);

CREATE TYPE "HumanRefinementResolutionType" AS ENUM (
  'DOCUMENT_UPDATED',
  'CLARIFICATION_ACCEPTED',
  'CONTROL_CONFIRMED',
  'NO_CHANGE_REQUIRED',
  'OTHER'
);

CREATE TYPE "HumanRefinementEvidenceType" AS ENUM (
  'DOCUMENT_EXCERPT',
  'REFERENCE_SOURCE',
  'CLARIFICATION_RESPONSE',
  'SUPPORTING_ATTACHMENT',
  'REVIEWER_NOTE'
);

CREATE TYPE "RefinementClarificationStatus" AS ENUM (
  'OPEN',
  'RESPONDED',
  'CLOSED'
);

CREATE TABLE "HumanRefinementFinding" (
  "id" TEXT NOT NULL,
  "refinementSessionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" "HumanRefinementFindingCategory" NOT NULL,
  "categoryExplanation" TEXT,
  "severity" "HumanRefinementSeverity" NOT NULL,
  "observation" TEXT NOT NULL,
  "documentLocation" TEXT,
  "blocking" BOOLEAN NOT NULL DEFAULT false,
  "blockingOverrideReason" TEXT,
  "riskImpact" TEXT,
  "recommendation" TEXT,
  "ownerId" TEXT,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "followUpSuggestedOwner" TEXT,
  "followUpTargetAt" TIMESTAMP(3),
  "followUpNote" TEXT,
  "status" "HumanRefinementFindingStatus" NOT NULL DEFAULT 'OPEN',
  "resolutionType" "HumanRefinementResolutionType",
  "resolutionSummary" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "deferReason" TEXT,
  "deferOwner" TEXT,
  "deferTargetAt" TIMESTAMP(3),
  "riskAcknowledgement" TEXT,
  "dismissalReason" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HumanRefinementFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HumanRefinementEvidence" (
  "id" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "type" "HumanRefinementEvidenceType" NOT NULL,
  "title" TEXT,
  "description" TEXT NOT NULL,
  "excerpt" TEXT,
  "source" TEXT,
  "documentLocation" TEXT,
  "attachmentKey" TEXT,
  "addedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HumanRefinementEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefinementClarification" (
  "id" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "requestedBusinessUnitId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "response" TEXT,
  "responseEvidence" TEXT,
  "status" "RefinementClarificationStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "respondedById" TEXT,
  "respondedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "closedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefinementClarification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HumanRefinementFinding_refinementSessionId_status_idx"
  ON "HumanRefinementFinding"("refinementSessionId", "status");
CREATE INDEX "HumanRefinementFinding_ownerId_idx"
  ON "HumanRefinementFinding"("ownerId");
CREATE INDEX "HumanRefinementEvidence_findingId_createdAt_idx"
  ON "HumanRefinementEvidence"("findingId", "createdAt");
CREATE INDEX "RefinementClarification_findingId_status_idx"
  ON "RefinementClarification"("findingId", "status");
CREATE INDEX "RefinementClarification_requestedBusinessUnitId_status_idx"
  ON "RefinementClarification"("requestedBusinessUnitId", "status");

ALTER TABLE "HumanRefinementFinding"
  ADD CONSTRAINT "HumanRefinementFinding_refinementSessionId_fkey"
  FOREIGN KEY ("refinementSessionId") REFERENCES "RefinementSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HumanRefinementFinding"
  ADD CONSTRAINT "HumanRefinementFinding_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HumanRefinementFinding"
  ADD CONSTRAINT "HumanRefinementFinding_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HumanRefinementFinding"
  ADD CONSTRAINT "HumanRefinementFinding_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HumanRefinementEvidence"
  ADD CONSTRAINT "HumanRefinementEvidence_findingId_fkey"
  FOREIGN KEY ("findingId") REFERENCES "HumanRefinementFinding"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HumanRefinementEvidence"
  ADD CONSTRAINT "HumanRefinementEvidence_addedById_fkey"
  FOREIGN KEY ("addedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefinementClarification"
  ADD CONSTRAINT "RefinementClarification_findingId_fkey"
  FOREIGN KEY ("findingId") REFERENCES "HumanRefinementFinding"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefinementClarification"
  ADD CONSTRAINT "RefinementClarification_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefinementClarification"
  ADD CONSTRAINT "RefinementClarification_requestedBusinessUnitId_fkey"
  FOREIGN KEY ("requestedBusinessUnitId") REFERENCES "BusinessUnit"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefinementClarification"
  ADD CONSTRAINT "RefinementClarification_respondedById_fkey"
  FOREIGN KEY ("respondedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefinementClarification"
  ADD CONSTRAINT "RefinementClarification_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
