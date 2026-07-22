-- CreateTable
CREATE TABLE "StorageIntegration" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageIntegration_provider_key" ON "StorageIntegration"("provider");
