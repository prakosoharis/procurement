import { Readable } from 'node:stream';
import { db as defaultDb } from './db.js';
import { allowedDocumentTypes, canManageBusinessUnit, nextVersion } from './documents.js';
import { ensureSopBusinessUnitFolder, ensureSopGroupFolder, sopDriveFileName } from './google-drive-folders.js';
import { deleteGoogleDriveFile, getGoogleDriveFileMetadata } from './google-drive.js';
import { uploadObject } from './storage.js';
import {
  createTransientUploadUrl as defaultCreateTransientUploadUrl,
  deleteTransientUpload as defaultDeleteTransientUpload,
  inspectTransientUpload as defaultInspectTransientUpload,
  readTransientUpload as defaultReadTransientUpload,
  TransientUploadStorageError
} from './transient-blob-storage.js';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SESSION_TTL_MS = 60 * 60 * 1000;
const ACTIVE_STATUSES = ['PENDING', 'UPLOADED', 'TRANSFERRING', 'FINALIZING'];
const BLOB_VISIBILITY_RETRY_DELAYS_MS = [0, 250, 750];

export class DirectUploadError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'DirectUploadError';
    this.code = code;
    this.status = status;
  }
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value) {
  return text(value) || null;
}

function safeTransferMessage(error) {
  if (error instanceof DirectUploadError || error instanceof TransientUploadStorageError) return error.message;
  return 'Pemindahan file ke Google Drive gagal. Coba upload kembali atau hubungkan ulang Google Drive.';
}

export function validateUploadMetadata(input, { versionUpload = false } = {}) {
  const fileName = text(input?.fileName);
  const contentType = text(input?.contentType);
  const fileSize = Number(input?.fileSize);
  const changeSummary = optionalText(input?.changeSummary);

  if (!fileName || !contentType || !Number.isInteger(fileSize) || fileSize < 1) {
    throw new DirectUploadError('INVALID_INPUT', 'Nama, tipe, dan ukuran file wajib diisi.');
  }
  if (fileName.length > 255 || contentType.length > 150 || fileSize > MAX_FILE_SIZE || !allowedDocumentTypes.has(contentType)) {
    throw new DirectUploadError('INVALID_INPUT', 'Hanya file PDF/DOCX hingga 25 MB yang dapat diunggah.');
  }
  if (versionUpload && (!changeSummary || changeSummary.length > 4000)) {
    throw new DirectUploadError('INVALID_INPUT', 'Catatan perubahan wajib diisi dan maksimal 4.000 karakter.');
  }

  return { fileName, contentType, fileSize, changeSummary };
}

function managerOrThrow(actor, businessUnitId) {
  if (!actor) throw new DirectUploadError('UNAUTHENTICATED', 'Authentication required.', 401);
  if (!canManageBusinessUnit(actor, businessUnitId)) {
    throw new DirectUploadError('FORBIDDEN', 'Anda tidak memiliki akses ke Business Unit ini.', 403);
  }
}

// Publishing at Group level binds every Business Unit under that Group, so it
// stays with the roles that already hold cross-Business-Unit authority. A
// Business Unit PIC must never be able to issue a document that governs its
// sibling Business Units.
function groupPublisherOrThrow(actor) {
  if (!actor) throw new DirectUploadError('UNAUTHENTICATED', 'Authentication required.', 401);
  if (!['SUPER_USER', 'CORPORATE_GOVERNANCE'].includes(actor.role)) {
    throw new DirectUploadError('FORBIDDEN', 'Hanya Super User atau Tim Procurement yang dapat menerbitkan dokumen level Group.', 403);
  }
}

// A session's authority follows the scope it was created under, so a Group
// upload keeps requiring Group-publishing rights all the way through
// complete/cancel/status rather than only at creation.
function sessionManagerOrThrow(actor, session) {
  if (session?.scopeType === 'GROUP') groupPublisherOrThrow(actor);
  else managerOrThrow(actor, session?.businessUnitId);
}

async function reviewerOrThrow(db, reviewerId) {
  const reviewer = await db.user.findFirst({
    where: { id: reviewerId, role: { in: ['SUPER_USER', 'CORPORATE_GOVERNANCE'] } },
    select: { id: true, name: true, email: true }
  });
  if (!reviewer) throw new DirectUploadError('INVALID_INPUT', 'Reviewer yang ditugaskan harus Super User atau Tim Procurement.');
  return reviewer;
}

async function expirePendingSessions(db) {
  await db.googleDriveUploadSession.updateMany({
    where: { status: { in: ['PENDING', 'UPLOADED'] }, expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED', failureReason: 'Sesi upload telah kedaluwarsa.' }
  });
}

function uploadDto(session, upload) {
  return {
    sessionId: session.id,
    uploadToken: upload.clientToken,
    transientBlobPath: session.transientBlobPath,
    expiresAt: upload.expiresAt,
    maxFileSizeBytes: MAX_FILE_SIZE,
    transport: 'VERCEL_BLOB'
  };
}

function completedDto(session, version, reviewer) {
  return {
    id: session.sopDocumentId,
    versionId: version.id,
    status: 'COMPLETED',
    documentStatus: 'DRAFT',
    version: version.versionNo,
    submittedBy: { id: session.createdById },
    reviewer
  };
}

function statusDto(session, { version = null, reviewer = null } = {}) {
  if (session.status === 'COMPLETED' && version) return completedDto(session, version, reviewer);
  return {
    sessionId: session.id,
    status: session.status,
    message: session.failureReason || (session.status === 'UPLOADED' || session.status === 'TRANSFERRING'
      ? 'File diterima dan sedang dipindahkan ke Google Drive.'
      : null),
    expiresAt: session.expiresAt.toISOString()
  };
}

async function addBlobGrant(db, session, createTransientUploadUrl) {
  try {
    const upload = await createTransientUploadUrl({
      sessionId: session.id,
      fileName: session.expectedFileName,
      contentType: session.contentType,
      fileSize: session.expectedFileSize,
      expiresAt: session.expiresAt
    });
    await db.googleDriveUploadSession.update({
      where: { id: session.id },
      data: { transientBlobPath: upload.pathname }
    });
    return uploadDto({ ...session, transientBlobPath: upload.pathname }, upload);
  } catch (error) {
    await db.googleDriveUploadSession.updateMany({
      where: { id: session.id, status: 'PENDING' },
      data: { status: 'FAILED', failureReason: safeTransferMessage(error) }
    }).catch(() => undefined);
    if (error instanceof TransientUploadStorageError) throw error;
    throw new DirectUploadError('STORAGE_UNAVAILABLE', 'Vercel Blob tidak dapat menyiapkan upload file.', 503);
  }
}

async function resumePendingUploadSession({
  db,
  session,
  createTransientUploadUrl,
  inspectTransientUpload
}) {
  if (!session || session.status !== 'PENDING') return null;

  if (!session.transientBlobPath) {
    return addBlobGrant(db, session, createTransientUploadUrl);
  }

  try {
    const blob = await inspectUploadedBlob(session.transientBlobPath, inspectTransientUpload);
    if (blobMatchesSession(blob, session)) {
      return {
        sessionId: session.id,
        transientBlobPath: session.transientBlobPath,
        expiresAt: session.expiresAt.toISOString(),
        maxFileSizeBytes: MAX_FILE_SIZE,
        transport: 'VERCEL_BLOB',
        alreadyUploaded: true
      };
    }
  } catch (error) {
    if (error instanceof TransientUploadStorageError) throw error;
    // The connection can disappear before the browser reaches Blob. Reissue a
    // short-lived token for the same pending session instead of locking retry.
    return addBlobGrant(db, session, createTransientUploadUrl);
  }

  await db.googleDriveUploadSession.updateMany({
    where: { id: session.id, status: 'PENDING' },
    data: { status: 'FAILED', failureReason: 'File upload sebelumnya tidak sesuai. Mulai upload kembali.' }
  });
  return null;
}

export async function prepareDocumentDirectUpload(actor, input, {
  db = defaultDb,
  createTransientUploadUrl = defaultCreateTransientUploadUrl,
  inspectTransientUpload = defaultInspectTransientUpload
} = {}) {
  const scopeType = text(input?.scopeType) === 'GROUP' ? 'GROUP' : 'BUSINESS_UNIT';
  const isGroup = scopeType === 'GROUP';
  const businessUnitId = isGroup ? null : text(input?.businessUnitId);
  const organizationGroupId = isGroup ? text(input?.organizationGroupId) : null;
  const documentTypeId = text(input?.documentTypeId);
  const title = text(input?.title);
  const language = text(input?.language) || 'id';
  const ownerId = text(input?.ownerId) || actor?.id;
  const reviewerId = text(input?.reviewerId);
  const file = validateUploadMetadata(input);
  if (!(isGroup ? organizationGroupId : businessUnitId) || !documentTypeId || !title || !ownerId || !reviewerId || title.length > 300 || language.length > 30) {
    throw new DirectUploadError('INVALID_INPUT', isGroup
      ? 'Group, jenis dokumen, judul, PIC, reviewer, dan file wajib diisi.'
      : 'Business Unit, jenis dokumen, judul, PIC, reviewer, dan file wajib diisi.');
  }
  if (isGroup) groupPublisherOrThrow(actor); else managerOrThrow(actor, businessUnitId);
  await expirePendingSessions(db);

  const ownerWhere = isGroup
    // A Group document's PIC is any Business Unit PIC inside that Group --
    // the same containment rule People uses for Group-scoped structures.
    ? { id: ownerId, role: 'BUSINESS_UNIT_PIC', businessUnit: { organizationGroupId } }
    : { id: ownerId, role: 'BUSINESS_UNIT_PIC', businessUnitId };
  const scopeKey = isGroup ? { organizationGroupId } : { businessUnitId };

  const [existing, owner, reviewer, scopeOwner, active] = await Promise.all([
    db.sopDocument.findFirst({ where: { ...scopeKey, documentTypeId, title, status: { not: 'ARCHIVED' } }, select: { id: true } }),
    db.user.findFirst({ where: ownerWhere, select: { id: true } }),
    reviewerOrThrow(db, reviewerId),
    isGroup
      ? db.organizationGroup.findUnique({ where: { id: organizationGroupId } })
      : db.businessUnit.findUnique({ where: { id: businessUnitId } }),
    db.googleDriveUploadSession.findFirst({
      where: { purpose: 'CREATE_DOCUMENT', status: { in: ACTIVE_STATUSES }, ...scopeKey, documentTypeId, title },
    })
  ]);
  if (existing) throw new DirectUploadError('CONFLICT', isGroup
    ? 'Dokumen dengan nama ini sudah ada untuk Group tersebut. Gunakan update versi.'
    : 'Dokumen dengan nama ini sudah ada untuk Business Unit tersebut. Gunakan update versi.', 409);
  if (active?.status === 'PENDING' && active.createdById === actor.id) {
    const resumed = await resumePendingUploadSession({ db, session: active, createTransientUploadUrl, inspectTransientUpload });
    if (resumed) return resumed;
  }
  if (active) throw new DirectUploadError('CONFLICT', 'Masih ada upload draft dengan nama yang sama yang sedang diproses.', 409);
  if (!owner) throw new DirectUploadError('INVALID_INPUT', isGroup
    ? 'PIC yang dipilih harus berasal dari Business Unit di dalam Group tersebut.'
    : 'PIC yang dipilih harus berasal dari Business Unit yang sama.');
  if (!reviewer) throw new DirectUploadError('INVALID_INPUT', 'Reviewer yang ditugaskan tidak valid.');
  if (!scopeOwner) throw new DirectUploadError('NOT_FOUND', isGroup ? 'Group tidak ditemukan.' : 'Business Unit tidak ditemukan.', 404);

  const versionNo = 'v1.0';
  const session = await db.googleDriveUploadSession.create({
    data: {
      purpose: 'CREATE_DOCUMENT', scopeType, businessUnitId, organizationGroupId,
      documentTypeId, ownerId, reviewerId,
      title, language, versionNo, expectedFileName: file.fileName,
      expectedDriveName: sopDriveFileName({ title, versionNo, fileName: file.fileName }),
      expectedFileSize: file.fileSize, contentType: file.contentType, googleDriveParentId: '',
      createdById: actor.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    }
  }).catch((error) => {
    if (error?.code === 'P2002') throw new DirectUploadError('CONFLICT', 'Masih ada upload draft dengan nama yang sama yang sedang diproses.', 409);
    throw error;
  });
  return addBlobGrant(db, session, createTransientUploadUrl);
}

export async function prepareVersionDirectUpload(actor, sopDocumentId, input, {
  db = defaultDb,
  createTransientUploadUrl = defaultCreateTransientUploadUrl,
  inspectTransientUpload = defaultInspectTransientUpload
} = {}) {
  const file = validateUploadMetadata(input, { versionUpload: true });
  const reviewerId = text(input?.reviewerId);
  if (!sopDocumentId || !reviewerId) throw new DirectUploadError('INVALID_INPUT', 'Reviewer dan file revisi wajib diisi.');
  await expirePendingSessions(db);

  const document = await db.sopDocument.findUnique({
    where: { id: sopDocumentId },
    include: { businessUnit: true, versions: { orderBy: { uploadedAt: 'desc' }, take: 1 } }
  });
  if (!document) throw new DirectUploadError('NOT_FOUND', 'Dokumen tidak ditemukan.', 404);
  if (document.scopeType === 'GROUP') groupPublisherOrThrow(actor); else managerOrThrow(actor, document.businessUnitId);
  const [reviewer, active] = await Promise.all([
    reviewerOrThrow(db, reviewerId),
    db.googleDriveUploadSession.findFirst({
      where: { purpose: 'CREATE_VERSION', status: { in: ACTIVE_STATUSES }, sopDocumentId },
    })
  ]);
  if (active?.status === 'PENDING' && active.createdById === actor.id) {
    const resumed = await resumePendingUploadSession({ db, session: active, createTransientUploadUrl, inspectTransientUpload });
    if (resumed) return resumed;
  }
  if (active) throw new DirectUploadError('CONFLICT', 'Masih ada upload revisi yang sedang diproses untuk SOP ini.', 409);

  const versionNo = document.versions[0] ? nextVersion(document.versions[0].versionNo) : 'v1.0';
  const session = await db.googleDriveUploadSession.create({
    data: {
      purpose: 'CREATE_VERSION', scopeType: document.scopeType,
      businessUnitId: document.businessUnitId, organizationGroupId: document.organizationGroupId, sopDocumentId,
      reviewerId, title: document.title, language: document.language, versionNo,
      expectedFileName: file.fileName,
      expectedDriveName: sopDriveFileName({ title: document.title, versionNo, fileName: file.fileName }),
      expectedFileSize: file.fileSize, contentType: file.contentType, googleDriveParentId: '',
      changeSummary: file.changeSummary, createdById: actor.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    }
  }).catch((error) => {
    if (error?.code === 'P2002') throw new DirectUploadError('CONFLICT', 'Masih ada upload revisi yang sedang diproses untuk SOP ini.', 409);
    throw error;
  });
  return addBlobGrant(db, session, createTransientUploadUrl);
}

function blobMatchesSession(blob, session) {
  return Boolean(
    blob && session.transientBlobPath &&
    blob.pathname === session.transientBlobPath &&
    Number(blob.size) === session.expectedFileSize &&
    blob.contentType === session.contentType
  );
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function inspectUploadedBlob(pathname, inspectTransientUpload) {
  let lastError;
  for (const delay of BLOB_VISIBILITY_RETRY_DELAYS_MS) {
    if (delay) await wait(delay);
    try {
      return await inspectTransientUpload(pathname);
    } catch (error) {
      lastError = error;
      if (error instanceof TransientUploadStorageError) throw error;
    }
  }
  throw lastError;
}

export async function markBlobUploadReady(actor, sessionId, {
  db = defaultDb,
  inspectTransientUpload = defaultInspectTransientUpload
} = {}) {
  const session = await db.googleDriveUploadSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new DirectUploadError('NOT_FOUND', 'Sesi upload tidak ditemukan.', 404);
  sessionManagerOrThrow(actor, session);
  if (session.createdById !== actor.id) throw new DirectUploadError('FORBIDDEN', 'Sesi upload ini dibuat oleh pengguna lain.', 403);
  if (session.status === 'COMPLETED') return { session, shouldTrigger: false };
  if (session.status !== 'PENDING' && session.status !== 'UPLOADED') {
    throw new DirectUploadError('CONFLICT', 'Sesi upload tidak dapat diselesaikan.', 409);
  }
  if (session.expiresAt < new Date()) {
    await db.googleDriveUploadSession.update({ where: { id: session.id }, data: { status: 'EXPIRED', failureReason: 'Sesi upload telah kedaluwarsa.' } });
    throw new DirectUploadError('CONFLICT', 'Sesi upload telah kedaluwarsa. Mulai upload kembali.', 409);
  }
  let blob;
  try {
    blob = await inspectUploadedBlob(session.transientBlobPath, inspectTransientUpload);
  } catch (error) {
    if (error instanceof TransientUploadStorageError) throw error;
    await db.googleDriveUploadSession.updateMany({
      where: { id: session.id, status: 'PENDING' },
      data: { status: 'FAILED', failureReason: 'File upload sementara tidak ditemukan. Mulai upload kembali.' }
    });
    throw new DirectUploadError('INVALID_UPLOAD', 'File upload sementara tidak ditemukan. Mulai upload kembali.', 400);
  }
  if (!blobMatchesSession(blob, session)) {
    await db.googleDriveUploadSession.updateMany({
      where: { id: session.id, status: 'PENDING' },
      data: { status: 'FAILED', failureReason: 'File upload tidak sesuai dengan nama, ukuran, atau tipe yang dipilih.' }
    });
    throw new DirectUploadError('INVALID_UPLOAD', 'File upload tidak sesuai dengan nama, ukuran, atau tipe yang dipilih.', 400);
  }
  const transitioned = await db.googleDriveUploadSession.updateMany({
    where: { id: session.id, status: 'PENDING' },
    data: { status: 'UPLOADED', failureReason: null }
  });
  return { session: { ...session, status: transitioned.count ? 'UPLOADED' : session.status }, shouldTrigger: Boolean(transitioned.count) };
}

export async function getDirectUploadStatus(actor, sessionId, { db = defaultDb } = {}) {
  const session = await db.googleDriveUploadSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new DirectUploadError('NOT_FOUND', 'Sesi upload tidak ditemukan.', 404);
  sessionManagerOrThrow(actor, session);
  if (session.createdById !== actor.id) throw new DirectUploadError('FORBIDDEN', 'Sesi upload ini dibuat oleh pengguna lain.', 403);
  if (session.status !== 'COMPLETED' || !session.sopVersionId) return statusDto(session);
  const [version, reviewer] = await Promise.all([
    db.sopVersion.findUnique({ where: { id: session.sopVersionId } }),
    reviewerOrThrow(db, session.reviewerId)
  ]);
  if (!version) throw new DirectUploadError('CONFLICT', 'Hasil sesi upload tidak lagi tersedia.', 409);
  return statusDto(session, { version, reviewer });
}

export async function cancelPendingDirectUpload(actor, sessionId, {
  db = defaultDb,
  deleteTransientUpload = defaultDeleteTransientUpload
} = {}) {
  const session = await db.googleDriveUploadSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new DirectUploadError('NOT_FOUND', 'Sesi upload tidak ditemukan.', 404);
  sessionManagerOrThrow(actor, session);
  if (session.createdById !== actor.id) throw new DirectUploadError('FORBIDDEN', 'Sesi upload ini dibuat oleh pengguna lain.', 403);

  if (session.status !== 'PENDING') {
    return { sessionId: session.id, status: session.status, message: session.failureReason || null };
  }

  const cancelled = await db.googleDriveUploadSession.updateMany({
    where: { id: session.id, status: 'PENDING' },
    data: { status: 'FAILED', failureReason: 'Upload dibatalkan sebelum file diterima.' }
  });
  if (cancelled.count) {
    await deleteTransientUpload(session.transientBlobPath).catch(() => undefined);
  }
  return {
    sessionId: session.id,
    status: cancelled.count ? 'FAILED' : 'PENDING',
    message: 'Upload dibatalkan sebelum file diterima.'
  };
}

export async function transferBlobUploadToGoogleDrive(sessionId, {
  db = defaultDb,
  readTransientUpload = defaultReadTransientUpload,
  deleteTransientUpload = defaultDeleteTransientUpload,
  upload = uploadObject
} = {}) {
  const session = await db.googleDriveUploadSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new DirectUploadError('NOT_FOUND', 'Sesi upload tidak ditemukan.', 404);
  if (session.status === 'COMPLETED') return getDirectUploadStatus({ id: session.createdById, role: 'SUPER_USER' }, sessionId, { db });
  if (session.status !== 'UPLOADED') return statusDto(session);

  const claimed = await db.googleDriveUploadSession.updateMany({
    where: { id: session.id, status: 'UPLOADED' },
    data: { status: 'TRANSFERRING', failureReason: null, lastTransferAt: new Date() }
  });
  if (!claimed.count) return statusDto(await db.googleDriveUploadSession.findUnique({ where: { id: session.id } }));

  let uploadedFileKey = null;
  try {
    const isGroupSession = session.scopeType === 'GROUP';
    const [blob, scopeOwner] = await Promise.all([
      readTransientUpload(session.transientBlobPath),
      isGroupSession
        ? db.organizationGroup.findUnique({ where: { id: session.organizationGroupId } })
        : db.businessUnit.findUnique({ where: { id: session.businessUnitId } })
    ]);
    if (!scopeOwner || !blob?.stream || !blobMatchesSession(blob.blob, session)) {
      throw new DirectUploadError('INVALID_UPLOAD', 'File upload sementara tidak lagi valid. Mulai upload kembali.', 400);
    }
    const folder = isGroupSession
      ? await ensureSopGroupFolder({ organizationGroup: scopeOwner })
      : await ensureSopBusinessUnitFolder({ businessUnit: scopeOwner, db });
    await db.googleDriveUploadSession.update({
      where: { id: session.id },
      data: { googleDriveParentId: folder.folderId }
    });
    const stored = await upload({
      key: `transient/${session.id}/${session.expectedDriveName}`,
      body: Readable.fromWeb(blob.stream),
      contentType: session.contentType,
      googleDriveParentId: folder.folderId,
      googleDriveFileName: session.expectedDriveName,
      googleDriveAppProperties: { procurementUploadSessionId: session.id }
    });
    uploadedFileKey = stored.key;
    const googleDriveFileId = stored.key.replace(/^gdrive:/, '');
    const driveFile = await getGoogleDriveFileMetadata(googleDriveFileId);
    if (!driveFileMatchesSession(driveFile, { ...session, googleDriveFileId, googleDriveParentId: folder.folderId })) {
      throw new DirectUploadError('INVALID_UPLOAD', 'File Google Drive hasil transfer tidak sesuai dengan sesi upload.', 502);
    }
    const result = await db.$transaction(async (tx) => {
      const current = await tx.googleDriveUploadSession.findUnique({ where: { id: session.id } });
      if (!current || current.status !== 'TRANSFERRING') throw new DirectUploadError('CONFLICT', 'Sesi upload tidak lagi dapat diproses.', 409);
      const reviewer = await tx.user.findFirst({
        where: { id: current.reviewerId, role: { in: ['SUPER_USER', 'CORPORATE_GOVERNANCE'] } },
        select: { id: true, name: true, email: true }
      });
      if (!reviewer) throw new DirectUploadError('INVALID_INPUT', 'Reviewer yang ditugaskan tidak lagi valid.');
      let document;
      if (current.purpose === 'CREATE_DOCUMENT') {
        const scopeKey = current.scopeType === 'GROUP'
          ? { organizationGroupId: current.organizationGroupId }
          : { businessUnitId: current.businessUnitId };
        const existing = await tx.sopDocument.findFirst({
          where: { ...scopeKey, documentTypeId: current.documentTypeId, title: current.title, status: { not: 'ARCHIVED' } },
          select: { id: true }
        });
        if (existing) throw new DirectUploadError('CONFLICT', current.scopeType === 'GROUP'
          ? 'Dokumen dengan nama ini sudah ada untuk Group tersebut.'
          : 'Dokumen dengan nama ini sudah ada untuk Business Unit tersebut.', 409);
        document = await tx.sopDocument.create({
          data: { scopeType: current.scopeType, ...scopeKey, documentTypeId: current.documentTypeId, ownerId: current.ownerId, title: current.title, language: current.language || 'id', status: 'DRAFT', currentVersion: current.versionNo }
        });
      } else {
        document = await tx.sopDocument.findUnique({ where: { id: current.sopDocumentId } });
        // A revision keeps the document's own scope; the session simply
        // points at the document, so compare on whichever owner applies.
        const sameOwner = document && (document.scopeType === 'GROUP'
          ? document.organizationGroupId === current.organizationGroupId
          : document.businessUnitId === current.businessUnitId);
        if (!sameOwner) throw new DirectUploadError('NOT_FOUND', 'Dokumen tidak ditemukan.', 404);
        const latest = await tx.sopVersion.findFirst({ where: { sopDocumentId: document.id }, orderBy: { uploadedAt: 'desc' }, select: { versionNo: true } });
        if ((latest ? nextVersion(latest.versionNo) : 'v1.0') !== current.versionNo) {
          throw new DirectUploadError('CONFLICT', 'Versi SOP telah berubah. Mulai upload revisi kembali.', 409);
        }
      }
      const version = await tx.sopVersion.create({
        data: {
          sopDocumentId: document.id, versionNo: current.versionNo, fileKey: stored.key,
          fileName: current.expectedFileName, fileSize: current.expectedFileSize, contentType: current.contentType,
          changeSummary: current.purpose === 'CREATE_DOCUMENT' ? 'Initial upload' : current.changeSummary,
          approvalStatus: 'DRAFT', lifecycleState: 'DRAFT', submittedById: current.createdById,
          submittedAt: new Date(), reviewerId: current.reviewerId
        }
      });
      if (current.purpose === 'CREATE_VERSION') {
        await tx.sopDocument.update({ where: { id: document.id }, data: { status: 'DRAFT', currentVersion: current.versionNo } });
      }
      await tx.auditLog.create({
        data: {
          actorId: current.createdById, entity: 'SopDocument', entityId: document.id,
          action: current.purpose === 'CREATE_DOCUMENT' ? 'CREATE_DRAFT' : 'CREATE_DRAFT_VERSION',
          detail: JSON.stringify({ version: version.versionNo, fileName: version.fileName, submittedById: current.createdById, reviewerId: current.reviewerId, uploadSessionId: current.id, transport: 'VERCEL_BLOB' })
        }
      });
      const completedSession = await tx.googleDriveUploadSession.update({
        where: { id: current.id },
        data: { status: 'COMPLETED', googleDriveFileId, sopDocumentId: document.id, sopVersionId: version.id, completedAt: new Date(), failureReason: null }
      });
      return { session: completedSession, version, reviewer };
    }, { isolationLevel: 'Serializable' });
    await deleteTransientUpload(session.transientBlobPath).catch((error) => console.error('Could not delete transient Vercel Blob upload.', error));
    return completedDto(result.session, result.version, result.reviewer);
  } catch (error) {
    console.error('Blob-to-Google Drive transfer failed.', error);
    if (uploadedFileKey?.startsWith('gdrive:')) {
      await deleteGoogleDriveFile(uploadedFileKey.slice('gdrive:'.length)).catch((cleanupError) => console.error('Could not remove failed Google Drive transfer.', cleanupError));
    }
    const message = safeTransferMessage(error);
    await db.googleDriveUploadSession.updateMany({
      where: { id: session.id, status: 'TRANSFERRING' },
      data: { status: 'FAILED', failureReason: message }
    }).catch(() => undefined);
    await db.auditLog.create({
      data: {
        actorId: session.createdById, entity: 'GoogleDriveUploadSession', entityId: session.id,
        action: 'GOOGLE_DRIVE_TRANSFER_FAILED', detail: JSON.stringify({ message, transport: 'VERCEL_BLOB' })
      }
    }).catch(() => undefined);
    return { sessionId: session.id, status: 'FAILED', message };
  }
}

// Retained as a focused metadata guard for existing tests and future storage adapters.
export function driveFileMatchesSession(file, session) {
  return Boolean(
    file && !file.trashed && file.id &&
    file.id === session.googleDriveFileId &&
    file.name === session.expectedDriveName &&
    file.mimeType === session.contentType &&
    Number(file.size) === session.expectedFileSize &&
    file.parents?.includes(session.googleDriveParentId) &&
    file.appProperties?.procurementUploadSessionId === session.id
  );
}
