CREATE TYPE "RefinementSessionStatus" AS ENUM ('NEW','IN_PROGRESS','WAITING_FOR_CLARIFICATION','BLOCKED','READY_FOR_COMPLETION','COMPLETED');
CREATE TABLE "RefinementSession" (
  "id" TEXT NOT NULL, "sopVersionId" TEXT NOT NULL, "businessUnitId" TEXT NOT NULL,
  "startedById" TEXT NOT NULL, "cycleNo" INTEGER NOT NULL, "mode" TEXT NOT NULL DEFAULT 'HUMAN_ONLY',
  "status" "RefinementSessionStatus" NOT NULL DEFAULT 'NEW', "summary" TEXT,
  "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "RefinementSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RefinementSession_sopVersionId_cycleNo_key" ON "RefinementSession"("sopVersionId","cycleNo");
CREATE INDEX "RefinementSession_businessUnitId_status_idx" ON "RefinementSession"("businessUnitId","status");
ALTER TABLE "RefinementSession" ADD CONSTRAINT "RefinementSession_sopVersionId_fkey" FOREIGN KEY ("sopVersionId") REFERENCES "SopVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefinementSession" ADD CONSTRAINT "RefinementSession_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefinementSession" ADD CONSTRAINT "RefinementSession_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
