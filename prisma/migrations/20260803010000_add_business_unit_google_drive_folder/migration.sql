ALTER TABLE "BusinessUnit" ADD COLUMN "googleDriveFolderId" TEXT;

CREATE UNIQUE INDEX "BusinessUnit_googleDriveFolderId_key"
ON "BusinessUnit"("googleDriveFolderId");
