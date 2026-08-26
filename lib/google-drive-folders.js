import { db as defaultDb } from "./db.js";
import { googleDriveClient } from "./google-drive.js";

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

function requiredText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function queryValue(value) {
  return value.replace(/'/g, "\\'");
}

export function driveFolderName(value) {
  return requiredText(value, "Folder name")
    .replace(/[\\/]/g, "-")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sopDriveFileName({ title, versionNo, fileName }) {
  const safeTitle = driveFolderName(title);
  const safeVersion = driveFolderName(versionNo);
  const safeFileName = requiredText(fileName, "File name").replace(/[\\/]/g, "-");
  return `${safeTitle} — ${safeVersion} — ${safeFileName}`;
}

export function googleDriveFileId(fileKey) {
  return typeof fileKey === "string" && fileKey.startsWith("gdrive:")
    ? fileKey.slice("gdrive:".length)
    : null;
}

async function getFolder(drive, folderId) {
  try {
    const result = await drive.files.get({
      fileId: folderId,
      fields: "id,name,mimeType,parents,trashed",
    });
    const folder = result.data;
    return folder?.mimeType === FOLDER_MIME_TYPE && !folder.trashed ? folder : null;
  } catch (error) {
    if ([403, 404].includes(error?.code)) return null;
    throw error;
  }
}

async function findChildFolder(drive, parentId, name) {
  const result = await drive.files.list({
    q: [
      `mimeType = '${FOLDER_MIME_TYPE}'`,
      `name = '${queryValue(name)}'`,
      `'${queryValue(parentId)}' in parents`,
      "trashed = false",
    ].join(" and "),
    fields: "files(id,name,mimeType,parents,trashed)",
    orderBy: "createdTime asc",
    pageSize: 10,
  });
  return result.data.files?.[0] ?? null;
}

async function ensureChildFolder(drive, parentId, name, appProperties) {
  const existing = await findChildFolder(drive, parentId, name);
  if (existing?.id) return existing;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME_TYPE,
      parents: [parentId],
      appProperties,
    },
    fields: "id,name,mimeType,parents,trashed",
  });
  if (!created.data.id) throw new Error(`Google Drive folder ${name} could not be created.`);
  return created.data;
}

async function driveContext(context = {}) {
  if (context.drive && context.rootFolderId) return context;
  const connected = await googleDriveClient();
  return { drive: connected.drive, rootFolderId: connected.folderId };
}

export async function resolveGoogleDriveFolderPath({ segments, create = false, ...context }) {
  const names = segments.map((segment) => driveFolderName(segment));
  const { drive, rootFolderId } = await driveContext(context);
  let parentId = rootFolderId;

  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    const folder = create
      ? await ensureChildFolder(drive, parentId, name, {
          procurementPath: names.slice(0, index + 1).join("/"),
        })
      : await findChildFolder(drive, parentId, name);

    if (!folder?.id) {
      return {
        folderId: null,
        complete: false,
        path: names.join("/"),
        missingSegments: names.slice(index),
      };
    }
    parentId = folder.id;
  }

  return { folderId: parentId, complete: true, path: names.join("/"), missingSegments: [] };
}

export async function resolveSopBusinessUnitFolder({ businessUnit, create = false, ...context }) {
  if (!businessUnit?.id || !businessUnit?.name) throw new Error("Business Unit identity is required.");
  const resolvedContext = await driveContext(context);

  if (businessUnit.googleDriveFolderId) {
    const storedFolder = await getFolder(resolvedContext.drive, businessUnit.googleDriveFolderId);
    if (storedFolder?.id) {
      return {
        folderId: storedFolder.id,
        complete: true,
        path: `SOP/${driveFolderName(businessUnit.name)}`,
        missingSegments: [],
      };
    }
  }

  return resolveGoogleDriveFolderPath({
    ...resolvedContext,
    segments: ["SOP", businessUnit.name],
    create,
  });
}

// Group documents live under SOP/Group/<name>/ rather than beside the
// Business Unit folders in SOP/<name>/. The extra segment keeps the two
// scopes visibly separate in Drive and removes any chance of a Group and a
// Business Unit that share a name colliding on one folder.
export async function ensureSopGroupFolder({ organizationGroup, create = true, ...context }) {
  if (!organizationGroup?.id || !organizationGroup?.name) throw new Error("Organization Group identity is required.");
  const resolvedContext = await driveContext(context);
  const resolved = await resolveGoogleDriveFolderPath({
    ...resolvedContext,
    segments: ["SOP", "Group", organizationGroup.name],
    create,
  });
  if (!resolved.folderId) throw new Error("Organization Group Google Drive folder could not be resolved.");
  return resolved;
}

export async function ensureSopBusinessUnitFolder({ businessUnit, db = defaultDb, ...context }) {
  const resolved = await resolveSopBusinessUnitFolder({ businessUnit, create: true, ...context });
  if (!resolved.folderId) throw new Error("Business Unit Google Drive folder could not be resolved.");

  if (businessUnit.googleDriveFolderId !== resolved.folderId) {
    await db.businessUnit.update({
      where: { id: businessUnit.id },
      data: { googleDriveFolderId: resolved.folderId },
    });
  }

  return resolved;
}

export async function ensureReferenceRegulationFolder({
  publisher,
  regulationNumber,
  internalCategory,
  ...context
}) {
  const normalizedPublisher = driveFolderName(publisher);
  const segments = ["Sumber Pembanding", normalizedPublisher];
  if (normalizedPublisher.toLowerCase() === "internal" && internalCategory) {
    segments.push(internalCategory);
  }
  if (regulationNumber) segments.push(regulationNumber);
  return resolveGoogleDriveFolderPath({ ...context, segments, create: true });
}

export async function moveGoogleDriveFile({ fileId, targetFolderId, ...context }) {
  const id = requiredText(fileId, "Google Drive file id");
  const target = requiredText(targetFolderId, "Target folder id");
  const { drive } = await driveContext(context);
  const file = await drive.files.get({ fileId: id, fields: "id,name,parents,trashed" });
  if (file.data.trashed) throw new Error(`Google Drive file ${id} is trashed.`);

  const parents = file.data.parents ?? [];
  if (parents.includes(target) && parents.length === 1) {
    return { moved: false, fileId: id, name: file.data.name ?? null, previousParents: parents, targetFolderId: target };
  }

  const result = await drive.files.update({
    fileId: id,
    ...(parents.includes(target) ? {} : { addParents: target }),
    ...(parents.filter((parent) => parent !== target).length
      ? { removeParents: parents.filter((parent) => parent !== target).join(",") }
      : {}),
    fields: "id,name,parents",
  });
  return {
    moved: true,
    fileId: id,
    name: result.data.name ?? file.data.name ?? null,
    previousParents: parents,
    targetFolderId: target,
  };
}
