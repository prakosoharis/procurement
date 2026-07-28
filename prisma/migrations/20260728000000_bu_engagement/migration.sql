CREATE TYPE "AttendanceStatus" AS ENUM ('INVITED', 'CONFIRMED', 'ATTENDED', 'DECLINED');

ALTER TABLE "AuditEventParticipant"
  ADD COLUMN "responseStatus" "AttendanceStatus" NOT NULL DEFAULT 'INVITED',
  ADD COLUMN "respondedAt" TIMESTAMP(3),
  ADD COLUMN "attendedAt" TIMESTAMP(3);
