CREATE TYPE "AuditEventStatus" AS ENUM ('PLANNED', 'SCHEDULED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "AuditEventFormat" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');
CREATE TYPE "AuditEventAudience" AS ENUM ('SELECTED_PICS', 'ALL_BUSINESS_UNITS');

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "businessUnitId" TEXT,
    "title" TEXT NOT NULL,
    "agenda" TEXT NOT NULL,
    "format" "AuditEventFormat" NOT NULL DEFAULT 'ONSITE',
    "audience" "AuditEventAudience" NOT NULL DEFAULT 'SELECTED_PICS',
    "location" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "status" "AuditEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEventParticipant" (
    "auditEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEventParticipant_pkey" PRIMARY KEY ("auditEventId", "userId")
);

CREATE INDEX "AuditEvent_businessUnitId_startAt_idx" ON "AuditEvent"("businessUnitId", "startAt");
CREATE INDEX "AuditEventParticipant_userId_idx" ON "AuditEventParticipant"("userId");

ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEventParticipant" ADD CONSTRAINT "AuditEventParticipant_auditEventId_fkey" FOREIGN KEY ("auditEventId") REFERENCES "AuditEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEventParticipant" ADD CONSTRAINT "AuditEventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
