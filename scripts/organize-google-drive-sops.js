const { PrismaClient } = require("@prisma/client");

async function loadFolders() {
  return import("../lib/google-drive-folders.js");
}

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  if (process.env.STORAGE_PROVIDER !== "google-drive") {
    throw new Error("STORAGE_PROVIDER must be google-drive to organize Google Drive SOP files.");
  }

  const folders = await loadFolders();
  const versions = await prisma.sopVersion.findMany({
    where: { fileKey: { startsWith: "gdrive:" } },
    include: { sopDocument: { include: { businessUnit: true } } },
    orderBy: { uploadedAt: "asc" },
  });
  const plan = [];

  for (const version of versions) {
    const businessUnit = version.sopDocument?.businessUnit;
    const fileId = folders.googleDriveFileId(version.fileKey);
    if (!businessUnit || !fileId) {
      plan.push({ versionId: version.id, status: "SKIPPED", reason: "Missing Business Unit or Google Drive file id." });
      continue;
    }

    plan.push({
      versionId: version.id,
      documentId: version.sopDocumentId,
      businessUnitId: businessUnit.id,
      businessUnit: businessUnit.name,
      fileId,
      fileName: version.fileName,
      targetPath: `SOP/${folders.driveFolderName(businessUnit.name)}`,
      // Dry-run is intentionally database-only: it is safe to inspect the
      // plan even when an admin is about to reconnect Google Drive.
      status: "PLANNED",
    });
  }

  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", total: plan.length, plan }, null, 2));
    return;
  }

  const results = [];
  for (const item of plan) {
    if (!item.fileId || !item.businessUnit || item.status === "SKIPPED") {
      results.push(item);
      continue;
    }

    const version = versions.find((candidate) => candidate.id === item.versionId);
    const folder = await folders.ensureSopBusinessUnitFolder({
      businessUnit: version.sopDocument.businessUnit,
      db: prisma,
    });
    const moved = await folders.moveGoogleDriveFile({ fileId: item.fileId, targetFolderId: folder.folderId });
    if (moved.moved) {
      await prisma.auditLog.create({
        data: {
          entity: "SopVersion",
          entityId: version.id,
          action: "GOOGLE_DRIVE_REORGANIZED",
          detail: JSON.stringify({
            fileId: item.fileId,
            businessUnitId: version.sopDocument.businessUnitId,
            targetPath: folder.path,
            targetFolderId: folder.folderId,
            previousParents: moved.previousParents,
          }),
        },
      });
    }
    results.push({ ...item, status: moved.moved ? "MOVED" : "ALREADY_ORGANIZED", targetFolderId: folder.folderId });
  }

  console.log(JSON.stringify({ mode: "apply", total: results.length, results }, null, 2));
}

main()
  .catch((error) => {
    console.error("Google Drive SOP organization failed.", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
