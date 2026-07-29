-- CreateEnum
CREATE TYPE "SopVersionLifecycleState" AS ENUM ('DRAFT', 'SUBMITTED', 'REFINEMENT', 'VALIDATION', 'APPROVED', 'READY_TO_PUBLISH', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReviewIntervalSource" AS ENUM ('VERSION_OVERRIDE', 'CATEGORY_CONFIGURATION', 'BUSINESS_UNIT_CONFIGURATION', 'SYSTEM_DEFAULT');

-- CreateEnum
CREATE TYPE "RefinementJobStatus" AS ENUM ('QUEUED', 'PREPARING', 'RETRIEVING', 'ANALYZING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefinementFindingHumanStatus" AS ENUM ('PENDING', 'ACCEPTED', 'ACCEPTED_WITH_MODIFICATION', 'REJECTED', 'RETURNED_FOR_REFINEMENT');

-- CreateEnum
CREATE TYPE "ValidationDecisionType" AS ENUM ('ACCEPTED', 'ACCEPTED_WITH_MODIFICATION', 'REJECTED', 'RETURNED_FOR_REFINEMENT');

-- CreateEnum
CREATE TYPE "PublishingStatus" AS ENUM ('NOT_READY', 'READY', 'IN_PROGRESS', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditReviewStatus" AS ENUM ('SCHEDULED', 'DUE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('REFINEMENT', 'CHATBOT', 'EXECUTIVE_COPILOT');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC', 'OPENAI');

-- CreateEnum
CREATE TYPE "AiEventType" AS ENUM ('BLOCKED_SCOPE', 'PROVIDER_FAILURE', 'FALLBACK_USED', 'INVALID_OUTPUT', 'RETRY', 'RATE_LIMITED', 'REQUEST_CANCELLED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'EXECUTIVE';

-- DropForeignKey
ALTER TABLE "Finding" DROP CONSTRAINT "Finding_requestId_fkey";

-- AlterTable
ALTER TABLE "ActionItem" ADD COLUMN     "refinementFindingId" TEXT;

-- AlterTable
ALTER TABLE "BusinessUnit" ADD COLUMN     "defaultReviewIntervalMonths" INTEGER;

-- AlterTable
ALTER TABLE "Finding" ADD COLUMN     "auditReviewId" TEXT,
ALTER COLUMN "requestId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReferenceSource" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SopDocument" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishedVersionId" TEXT;

-- AlterTable
ALTER TABLE "SopVersion" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "effectiveAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleState" "SopVersionLifecycleState" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "nextReviewAt" TIMESTAMP(3),
ADD COLUMN     "reviewIntervalMonths" INTEGER,
ADD COLUMN     "reviewIntervalSource" "ReviewIntervalSource",
ADD COLUMN     "reviewOverrideReason" TEXT,
ADD COLUMN     "reviewerId" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedById" TEXT;

-- Non-destructive legacy lifecycle mapping. Existing IN_REVIEW remains DRAFT
-- until Tim Procurement manually classifies it as REFINEMENT or VALIDATION.
UPDATE "SopVersion" AS version
SET "lifecycleState" = CASE document."status"
  WHEN 'PUBLISHED' THEN 'PUBLISHED'::"SopVersionLifecycleState"
  WHEN 'ARCHIVED' THEN 'ARCHIVED'::"SopVersionLifecycleState"
  WHEN 'APPROVED' THEN 'APPROVED'::"SopVersionLifecycleState"
  ELSE 'DRAFT'::"SopVersionLifecycleState"
END
FROM "SopDocument" AS document
WHERE version."sopDocumentId" = document."id";

-- A legacy PUBLISHED document with a matching current version is the only
-- automatic official-version mapping. APPROVED records are intentionally not
-- promoted to PUBLISHED by this migration.
UPDATE "SopDocument" AS document
SET "publishedVersionId" = version."id"
FROM "SopVersion" AS version
WHERE document."status" = 'PUBLISHED'
  AND document."currentVersion" IS NOT NULL
  AND version."sopDocumentId" = document."id"
  AND version."versionNo" = document."currentVersion";

-- CreateTable
CREATE TABLE "SopCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reviewIntervalMonths" INTEGER,
    "isHighRisk" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SopCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBusinessUnitScope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBusinessUnitScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefinementJob" (
    "id" TEXT NOT NULL,
    "sopVersionId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "RefinementJobStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" "AiProvider",
    "model" TEXT,
    "promptVersion" TEXT,
    "configurationJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorType" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefinementJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefinementFinding" (
    "id" TEXT NOT NULL,
    "refinementJobId" TEXT NOT NULL,
    "sopVersionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "RiskLevel" NOT NULL,
    "currentState" TEXT,
    "gap" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "evidenceJson" JSONB,
    "humanStatus" "RefinementFindingHumanStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefinementFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationDecision" (
    "id" TEXT NOT NULL,
    "sopVersionId" TEXT NOT NULL,
    "refinementFindingId" TEXT,
    "reviewerId" TEXT NOT NULL,
    "decision" "ValidationDecisionType" NOT NULL,
    "comment" TEXT,
    "previousLifecycleState" "SopVersionLifecycleState" NOT NULL,
    "resultingLifecycleState" "SopVersionLifecycleState" NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishingRecord" (
    "id" TEXT NOT NULL,
    "sopVersionId" TEXT NOT NULL,
    "status" "PublishingStatus" NOT NULL DEFAULT 'NOT_READY',
    "externalSystem" TEXT NOT NULL DEFAULT 'IMEMO',
    "externalReference" TEXT,
    "externalUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "notes" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditReview" (
    "id" TEXT NOT NULL,
    "sopDocumentId" TEXT NOT NULL,
    "sopVersionId" TEXT,
    "businessUnitId" TEXT NOT NULL,
    "auditEventId" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" "AuditReviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "businessUnitId" TEXT,
    "feature" "AiFeature" NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT,
    "requestTimestamp" TIMESTAMP(3) NOT NULL,
    "responseTimestamp" TIMESTAMP(3),
    "latencyMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "costCurrency" TEXT NOT NULL DEFAULT 'USD',
    "pricingVersion" TEXT,
    "pricingInputRate" DOUBLE PRECISION,
    "pricingOutputRate" DOUBLE PRECISION,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorType" TEXT,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "refinementJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEvent" (
    "id" TEXT NOT NULL,
    "aiUsageId" TEXT,
    "userId" TEXT,
    "businessUnitId" TEXT,
    "feature" "AiFeature" NOT NULL,
    "eventType" "AiEventType" NOT NULL,
    "provider" "AiProvider",
    "model" TEXT,
    "reason" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SopCategory_name_key" ON "SopCategory"("name");

-- CreateIndex
CREATE INDEX "UserBusinessUnitScope_businessUnitId_idx" ON "UserBusinessUnitScope"("businessUnitId");

-- CreateIndex
CREATE INDEX "UserBusinessUnitScope_createdById_idx" ON "UserBusinessUnitScope"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "UserBusinessUnitScope_userId_businessUnitId_key" ON "UserBusinessUnitScope"("userId", "businessUnitId");

-- CreateIndex
CREATE INDEX "RefinementJob_sopVersionId_idx" ON "RefinementJob"("sopVersionId");

-- CreateIndex
CREATE INDEX "RefinementJob_businessUnitId_idx" ON "RefinementJob"("businessUnitId");

-- CreateIndex
CREATE INDEX "RefinementJob_requestedById_idx" ON "RefinementJob"("requestedById");

-- CreateIndex
CREATE INDEX "RefinementJob_fingerprint_idx" ON "RefinementJob"("fingerprint");

-- CreateIndex
CREATE INDEX "RefinementJob_status_idx" ON "RefinementJob"("status");

-- CreateIndex
CREATE INDEX "RefinementJob_createdAt_idx" ON "RefinementJob"("createdAt");

-- CreateIndex
CREATE INDEX "RefinementFinding_refinementJobId_idx" ON "RefinementFinding"("refinementJobId");

-- CreateIndex
CREATE INDEX "RefinementFinding_sopVersionId_idx" ON "RefinementFinding"("sopVersionId");

-- CreateIndex
CREATE INDEX "RefinementFinding_humanStatus_idx" ON "RefinementFinding"("humanStatus");

-- CreateIndex
CREATE INDEX "RefinementFinding_severity_idx" ON "RefinementFinding"("severity");

-- CreateIndex
CREATE INDEX "ValidationDecision_sopVersionId_idx" ON "ValidationDecision"("sopVersionId");

-- CreateIndex
CREATE INDEX "ValidationDecision_refinementFindingId_idx" ON "ValidationDecision"("refinementFindingId");

-- CreateIndex
CREATE INDEX "ValidationDecision_reviewerId_idx" ON "ValidationDecision"("reviewerId");

-- CreateIndex
CREATE INDEX "ValidationDecision_createdAt_idx" ON "ValidationDecision"("createdAt");

-- CreateIndex
CREATE INDEX "PublishingRecord_sopVersionId_idx" ON "PublishingRecord"("sopVersionId");

-- CreateIndex
CREATE INDEX "PublishingRecord_status_idx" ON "PublishingRecord"("status");

-- CreateIndex
CREATE INDEX "PublishingRecord_publishedById_idx" ON "PublishingRecord"("publishedById");

-- CreateIndex
CREATE UNIQUE INDEX "AuditReview_auditEventId_key" ON "AuditReview"("auditEventId");

-- CreateIndex
CREATE INDEX "AuditReview_sopDocumentId_idx" ON "AuditReview"("sopDocumentId");

-- CreateIndex
CREATE INDEX "AuditReview_sopVersionId_idx" ON "AuditReview"("sopVersionId");

-- CreateIndex
CREATE INDEX "AuditReview_businessUnitId_idx" ON "AuditReview"("businessUnitId");

-- CreateIndex
CREATE INDEX "AuditReview_ownerId_idx" ON "AuditReview"("ownerId");

-- CreateIndex
CREATE INDEX "AuditReview_status_idx" ON "AuditReview"("status");

-- CreateIndex
CREATE INDEX "AuditReview_dueAt_idx" ON "AuditReview"("dueAt");

-- CreateIndex
CREATE INDEX "AiUsage_userId_idx" ON "AiUsage"("userId");

-- CreateIndex
CREATE INDEX "AiUsage_businessUnitId_idx" ON "AiUsage"("businessUnitId");

-- CreateIndex
CREATE INDEX "AiUsage_feature_idx" ON "AiUsage"("feature");

-- CreateIndex
CREATE INDEX "AiUsage_provider_idx" ON "AiUsage"("provider");

-- CreateIndex
CREATE INDEX "AiUsage_refinementJobId_idx" ON "AiUsage"("refinementJobId");

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AiEvent_aiUsageId_idx" ON "AiEvent"("aiUsageId");

-- CreateIndex
CREATE INDEX "AiEvent_userId_idx" ON "AiEvent"("userId");

-- CreateIndex
CREATE INDEX "AiEvent_businessUnitId_idx" ON "AiEvent"("businessUnitId");

-- CreateIndex
CREATE INDEX "AiEvent_feature_idx" ON "AiEvent"("feature");

-- CreateIndex
CREATE INDEX "AiEvent_eventType_idx" ON "AiEvent"("eventType");

-- CreateIndex
CREATE INDEX "AiEvent_createdAt_idx" ON "AiEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ActionItem_refinementFindingId_idx" ON "ActionItem"("refinementFindingId");

-- CreateIndex
CREATE INDEX "Finding_requestId_idx" ON "Finding"("requestId");

-- CreateIndex
CREATE INDEX "Finding_auditReviewId_idx" ON "Finding"("auditReviewId");

-- CreateIndex
CREATE UNIQUE INDEX "SopDocument_publishedVersionId_key" ON "SopDocument"("publishedVersionId");

-- CreateIndex
CREATE INDEX "SopDocument_categoryId_idx" ON "SopDocument"("categoryId");

-- CreateIndex
CREATE INDEX "SopVersion_lifecycleState_idx" ON "SopVersion"("lifecycleState");

-- CreateIndex
CREATE INDEX "SopVersion_nextReviewAt_idx" ON "SopVersion"("nextReviewAt");

-- CreateIndex
CREATE INDEX "SopVersion_reviewerId_idx" ON "SopVersion"("reviewerId");

-- CreateIndex
CREATE INDEX "SopVersion_submittedById_idx" ON "SopVersion"("submittedById");

-- AddForeignKey
ALTER TABLE "UserBusinessUnitScope" ADD CONSTRAINT "UserBusinessUnitScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBusinessUnitScope" ADD CONSTRAINT "UserBusinessUnitScope_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBusinessUnitScope" ADD CONSTRAINT "UserBusinessUnitScope_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SopDocument" ADD CONSTRAINT "SopDocument_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SopCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SopDocument" ADD CONSTRAINT "SopDocument_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "SopVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SopVersion" ADD CONSTRAINT "SopVersion_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SopVersion" ADD CONSTRAINT "SopVersion_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SopRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_auditReviewId_fkey" FOREIGN KEY ("auditReviewId") REFERENCES "AuditReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_refinementFindingId_fkey" FOREIGN KEY ("refinementFindingId") REFERENCES "RefinementFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefinementJob" ADD CONSTRAINT "RefinementJob_sopVersionId_fkey" FOREIGN KEY ("sopVersionId") REFERENCES "SopVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefinementJob" ADD CONSTRAINT "RefinementJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefinementJob" ADD CONSTRAINT "RefinementJob_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefinementFinding" ADD CONSTRAINT "RefinementFinding_refinementJobId_fkey" FOREIGN KEY ("refinementJobId") REFERENCES "RefinementJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefinementFinding" ADD CONSTRAINT "RefinementFinding_sopVersionId_fkey" FOREIGN KEY ("sopVersionId") REFERENCES "SopVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationDecision" ADD CONSTRAINT "ValidationDecision_sopVersionId_fkey" FOREIGN KEY ("sopVersionId") REFERENCES "SopVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationDecision" ADD CONSTRAINT "ValidationDecision_refinementFindingId_fkey" FOREIGN KEY ("refinementFindingId") REFERENCES "RefinementFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationDecision" ADD CONSTRAINT "ValidationDecision_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingRecord" ADD CONSTRAINT "PublishingRecord_sopVersionId_fkey" FOREIGN KEY ("sopVersionId") REFERENCES "SopVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingRecord" ADD CONSTRAINT "PublishingRecord_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReview" ADD CONSTRAINT "AuditReview_sopDocumentId_fkey" FOREIGN KEY ("sopDocumentId") REFERENCES "SopDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReview" ADD CONSTRAINT "AuditReview_sopVersionId_fkey" FOREIGN KEY ("sopVersionId") REFERENCES "SopVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReview" ADD CONSTRAINT "AuditReview_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReview" ADD CONSTRAINT "AuditReview_auditEventId_fkey" FOREIGN KEY ("auditEventId") REFERENCES "AuditEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReview" ADD CONSTRAINT "AuditReview_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_refinementJobId_fkey" FOREIGN KEY ("refinementJobId") REFERENCES "RefinementJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvent" ADD CONSTRAINT "AiEvent_aiUsageId_fkey" FOREIGN KEY ("aiUsageId") REFERENCES "AiUsage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvent" ADD CONSTRAINT "AiEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvent" ADD CONSTRAINT "AiEvent_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;


