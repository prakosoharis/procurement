-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BU_PIC', 'CORPORATE_PROCUREMENT', 'COMPLIANCE_REVIEWER', 'COMPLIANCE_ADMIN', 'EXECUTIVE', 'IT_ADMIN');

-- CreateEnum
CREATE TYPE "SopStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'OVERDUE');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "BusinessUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "groupName" TEXT NOT NULL DEFAULT 'Unclassified',
    "industry" TEXT NOT NULL DEFAULT 'Unclassified',
    "organizationGroupId" TEXT,
    "industryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Industry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "businessUnitId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "phone" TEXT,
    "jobTitle" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'id',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SopDocument" (
    "id" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "ownerId" TEXT,
    "documentTypeId" TEXT,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'id',
    "status" "SopStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SopDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SopVersion" (
    "id" TEXT NOT NULL,
    "sopDocumentId" TEXT NOT NULL,
    "versionNo" TEXT NOT NULL,
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "contentType" TEXT,
    "changeSummary" TEXT,
    "approvalStatus" "SopStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SopVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SopRequest" (
    "id" TEXT NOT NULL,
    "clientRequestKey" TEXT,
    "requesterId" TEXT NOT NULL,
    "sopDocumentId" TEXT,
    "title" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "description" TEXT,
    "changeType" TEXT,
    "clauseReference" TEXT,
    "currentText" TEXT,
    "proposedText" TEXT,
    "businessImpact" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "reviewerComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SopRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketNotification" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "risk" "RiskLevel" NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "findingId" TEXT,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceSource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileKey" TEXT,
    "sourceUrl" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferenceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUnit_name_key" ON "BusinessUnit"("name");
CREATE UNIQUE INDEX "OrganizationGroup_name_key" ON "OrganizationGroup"("name");
CREATE UNIQUE INDEX "Industry_name_key" ON "Industry"("name");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "SopDocument_businessUnitId_documentTypeId_idx" ON "SopDocument"("businessUnitId", "documentTypeId");
CREATE UNIQUE INDEX "SopVersion_sopDocumentId_versionNo_key" ON "SopVersion"("sopDocumentId", "versionNo");
CREATE UNIQUE INDEX "DocumentType_code_key" ON "DocumentType"("code");
CREATE UNIQUE INDEX "DocumentType_name_key" ON "DocumentType"("name");
CREATE UNIQUE INDEX "SopRequest_clientRequestKey_key" ON "SopRequest"("clientRequestKey");
CREATE UNIQUE INDEX "TicketNotification_messageId_recipientId_key" ON "TicketNotification"("messageId", "recipientId");

-- AddForeignKey
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_organizationGroupId_fkey" FOREIGN KEY ("organizationGroupId") REFERENCES "OrganizationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SopDocument" ADD CONSTRAINT "SopDocument_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SopDocument" ADD CONSTRAINT "SopDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SopDocument" ADD CONSTRAINT "SopDocument_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SopVersion" ADD CONSTRAINT "SopVersion_sopDocumentId_fkey" FOREIGN KEY ("sopDocumentId") REFERENCES "SopDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SopVersion" ADD CONSTRAINT "SopVersion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SopRequest" ADD CONSTRAINT "SopRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SopRequest" ADD CONSTRAINT "SopRequest_sopDocumentId_fkey" FOREIGN KEY ("sopDocumentId") REFERENCES "SopDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RequestMessage" ADD CONSTRAINT "RequestMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SopRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequestMessage" ADD CONSTRAINT "RequestMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketNotification" ADD CONSTRAINT "TicketNotification_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "RequestMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketNotification" ADD CONSTRAINT "TicketNotification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SopRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
