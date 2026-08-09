import { db as defaultDb } from './db.js';
import { allowedDocumentTypes, canManageBusinessUnit, nextVersion } from './documents.js';
import { ensureSopBusinessUnitFolder, sopDriveFileName } from './google-drive-folders.js';
import {
  createDirectUploadSession as defaultCreateDirectUploadSession,
  getDirectUploadMetadata as defaultGetDirectUploadMetadata,
  StorageConfigurationError
} from './storage.js';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SESSION_TTL_MS = 60 * 60 * 1000;
const CHUNK_SIZE_BYTES = 8 * 1024 * 1024;

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
  const result = text(value);
  return result || null;
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
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' }
  });
}

function dto(session, resumable) {
  return {
    sessionId: session.id,
    uploadUrl: resumable.uploadUrl,
    expiresAt: session.expiresAt.toISOString(),
    chunkSizeBytes: CHUNK_SIZE_BYTES
  };
}

async function createResumableSession({ db, createDirectUploadSession, session, businessUnit, driveName }) {
  try {
    const folder = await ensureSopBusinessUnitFolder({ businessUnit, db });
    const resumable = await createDirectUploadSession({
      fileName: driveName,
      fileSize: session.expectedFileSize,
      contentType: session.contentType,
      googleDriveParentId: folder.folderId,
      appProperties: { procurementUploadSessionId: session.id }
    });
    await db.googleDriveUploadSession.update({
      where: { id: session.id },
      data: { googleDriveParentId: folder.folderId }
    });
    return dto(session, resumable);
  } catch (error) {
    await db.googleDriveUploadSession.updateMany({
      where: { id: session.id, status: 'PENDING' },
      data: { status: 'FAILED' }
    }).catch(() => undefined);
    if (error instanceof StorageConfigurationError) throw error;
    throw new DirectUploadError('STORAGE_UNAVAILABLE', 'Google Drive tidak dapat menyiapkan sesi upload.', 503);
  }
}

export async function prepareDocumentDirectUpload(actor, input, {
  db = defaultDb,
  createDirectUploadSession = defaultCreateDirectUploadSession
} = {}) {
  const businessUnitId = text(input?.businessUnitId);
  const documentTypeId = text(input?.documentTypeId);
  const title = text(input?.title);
  const language = text(input?.language) || 'id';
  const ownerId = text(input?.ownerId) || actor?.id;
  const reviewerId = text(input?.reviewerId);
  const file = validateUploadMetadata(input);
  if (!businessUnitId || !documentTypeId || !title || !ownerId || !reviewerId || title.length > 300 || language.length > 30) {
    throw new DirectUploadError('INVALID_INPUT', 'Business Unit, jenis dokumen, judul, PIC, reviewer, dan file wajib diisi.');
  }
  managerOrThrow(actor, businessUnitId);
  await expirePendingSessions(db);

  const [existing, owner, reviewer, businessUnit, pending] = await Promise.all([
    db.sopDocument.findFirst({ where: { businessUnitId, documentTypeId, status: { not: 'ARCHIVED' } }, select: { id: true } }),
    db.user.findFirst({ where: { id: ownerId, role: 'BUSINESS_UNIT_PIC', businessUnitId }, select: { id: true } }),
    reviewerOrThrow(db, reviewerId),
    db.businessUnit.findUnique({ where: { id: businessUnitId } }),
    db.googleDriveUploadSession.findFirst({
      where: { purpose: 'CREATE_DOCUMENT', status: 'PENDING', businessUnitId, documentTypeId },
      select: { id: true }
    })
  ]);
  if (existing) throw new DirectUploadError('CONFLICT', 'Jenis dokumen ini sudah ada untuk Business Unit tersebut. Gunakan update versi.', 409);
  if (pending) throw new DirectUploadError('CONFLICT', 'Masih ada upload draft yang sedang diproses untuk dokumen ini. Selesaikan atau tunggu sesi tersebut kedaluwarsa.', 409);
  if (!owner) throw new DirectUploadError('INVALID_INPUT', 'PIC yang dipilih harus berasal dari Business Unit yang sama.');
  if (!businessUnit) throw new DirectUploadError('NOT_FOUND', 'Business Unit tidak ditemukan.', 404);

  const versionNo = 'v1.0';
  const driveName = sopDriveFileName({ title, versionNo, fileName: file.fileName });
  let session;
  try {
    session = await db.googleDriveUploadSession.create({
      data: {
        purpose: 'CREATE_DOCUMENT', businessUnitId, documentTypeId, ownerId, reviewerId,
        title, language, versionNo, expectedFileName: file.fileName, expectedDriveName: driveName,
        expectedFileSize: file.fileSize, contentType: file.contentType, googleDriveParentId: '',
        createdById: actor.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS)
      }
    });
  } catch (error) {
    if (error?.code === 'P2002') throw new DirectUploadError('CONFLICT', 'Masih ada upload draft yang sedang diproses untuk dokumen ini.', 409);
    throw error;
  }
  return createResumableSession({ db, createDirectUploadSession, session, businessUnit, driveName });
}

export async function prepareVersionDirectUpload(actor, sopDocumentId, input, {
  db = defaultDb,
  createDirectUploadSession = defaultCreateDirectUploadSession
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
  managerOrThrow(actor, document.businessUnitId);
  const [reviewer, pending] = await Promise.all([
    reviewerOrThrow(db, reviewerId),
    db.googleDriveUploadSession.findFirst({ where: { purpose: 'CREATE_VERSION', status: 'PENDING', sopDocumentId }, select: { id: true } })
  ]);
  if (pending) throw new DirectUploadError('CONFLICT', 'Masih ada upload revisi yang sedang diproses untuk SOP ini.', 409);

  const versionNo = document.versions[0] ? nextVersion(document.versions[0].versionNo) : 'v1.0';
  const driveName = sopDriveFileName({ title: document.title, versionNo, fileName: file.fileName });
  let session;
  try {
    session = await db.googleDriveUploadSession.create({
      data: {
        purpose: 'CREATE_VERSION', businessUnitId: document.businessUnitId, sopDocumentId,
        reviewerId, title: document.title, language: document.language, versionNo,
        expectedFileName: file.fileName, expectedDriveName: driveName, expectedFileSize: file.fileSize,
        contentType: file.contentType, googleDriveParentId: '', changeSummary: file.changeSummary,
        createdById: actor.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS)
      }
    });
  } catch (error) {
    if (error?.code === 'P2002') throw new DirectUploadError('CONFLICT', 'Masih ada upload revisi yang sedang diproses untuk SOP ini.', 409);
    throw error;
  }
  return createResumableSession({ db, createDirectUploadSession, session, businessUnit: document.businessUnit, driveName });
}

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

function completedDto(session, version, reviewer) {
  return {
    id: session.sopDocumentId,
    versionId: version.id,
    status: 'DRAFT',
    version: version.versionNo,
    submittedBy: { id: session.createdById },
    reviewer
  };
}

export async function completeDirectUpload(actor, sessionId, input, {
  db = defaultDb,
  getDirectUploadMetadata = defaultGetDirectUploadMetadata
} = {}) {
  const googleDriveFileId = text(input?.googleDriveFileId);
  if (!googleDriveFileId || googleDriveFileId.length > 200) throw new DirectUploadError('INVALID_INPUT', 'Google Drive file ID tidak valid.');
  const session = await db.googleDriveUploadSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new DirectUploadError('NOT_FOUND', 'Sesi upload tidak ditemukan.', 404);
  managerOrThrow(actor, session.businessUnitId);
  if (session.createdById !== actor.id) throw new DirectUploadError('FORBIDDEN', 'Sesi upload ini dibuat oleh pengguna lain.', 403);
  if (session.status === 'COMPLETED') {
    if (session.googleDriveFileId !== googleDriveFileId || !session.sopVersionId) {
      throw new DirectUploadError('CONFLICT', 'Sesi upload sudah diselesaikan dengan file lain.', 409);
    }
    const [version, reviewer] = await Promise.all([
      db.sopVersion.findUnique({ where: { id: session.sopVersionId } }),
      reviewerOrThrow(db, session.reviewerId)
    ]);
    if (!version) throw new DirectUploadError('CONFLICT', 'Hasil sesi upload tidak lagi tersedia.', 409);
    return completedDto(session, version, reviewer);
  }
  if (session.status !== 'PENDING') throw new DirectUploadError('CONFLICT', 'Sesi upload tidak dapat diselesaikan.', 409);
  if (session.expiresAt < new Date()) {
    await db.googleDriveUploadSession.update({ where: { id: session.id }, data: { status: 'EXPIRED' } });
    throw new DirectUploadError('CONFLICT', 'Sesi upload telah kedaluwarsa. Mulai upload kembali.', 409);
  }

  const claimed = await db.googleDriveUploadSession.updateMany({
    where: { id: session.id, status: 'PENDING' },
    data: { status: 'FINALIZING', googleDriveFileId }
  });
  if (claimed.count !== 1) throw new DirectUploadError('CONFLICT', 'Sesi upload sedang diproses. Muat ulang sebentar lagi.', 409);

  try {
    const file = await getDirectUploadMetadata(googleDriveFileId);
    const claimedSession = { ...session, googleDriveFileId };
    if (!driveFileMatchesSession(file, claimedSession)) {
      throw new DirectUploadError('INVALID_UPLOAD', 'File Google Drive tidak sesuai dengan sesi upload.', 400);
    }
    const result = await db.$transaction(async (tx) => {
      const current = await tx.googleDriveUploadSession.findUnique({ where: { id: session.id } });
      if (!current || current.status !== 'FINALIZING') throw new DirectUploadError('CONFLICT', 'Sesi upload tidak lagi dapat diselesaikan.', 409);
      const reviewer = await tx.user.findFirst({
        where: { id: current.reviewerId, role: { in: ['SUPER_USER', 'CORPORATE_GOVERNANCE'] } },
        select: { id: true, name: true, email: true }
      });
      if (!reviewer) throw new DirectUploadError('INVALID_INPUT', 'Reviewer yang ditugaskan tidak lagi valid.');
      let document;
      if (current.purpose === 'CREATE_DOCUMENT') {
        const existing = await tx.sopDocument.findFirst({
          where: { businessUnitId: current.businessUnitId, documentTypeId: current.documentTypeId, status: { not: 'ARCHIVED' } },
          select: { id: true }
        });
        if (existing) throw new DirectUploadError('CONFLICT', 'Jenis dokumen ini sudah ada untuk Business Unit tersebut.', 409);
        document = await tx.sopDocument.create({
          data: { businessUnitId: current.businessUnitId, documentTypeId: current.documentTypeId, ownerId: current.ownerId, title: current.title, language: current.language || 'id', status: 'DRAFT', currentVersion: current.versionNo }
        });
      } else {
        document = await tx.sopDocument.findUnique({ where: { id: current.sopDocumentId } });
        if (!document || document.businessUnitId !== current.businessUnitId) throw new DirectUploadError('NOT_FOUND', 'Dokumen tidak ditemukan.', 404);
        const latest = await tx.sopVersion.findFirst({ where: { sopDocumentId: document.id }, orderBy: { uploadedAt: 'desc' }, select: { versionNo: true } });
        if ((latest ? nextVersion(latest.versionNo) : 'v1.0') !== current.versionNo) {
          throw new DirectUploadError('CONFLICT', 'Versi SOP telah berubah. Mulai upload revisi kembali.', 409);
        }
      }
      const version = await tx.sopVersion.create({
        data: {
          sopDocumentId: document.id, versionNo: current.versionNo, fileKey: `gdrive:${googleDriveFileId}`,
          fileName: current.expectedFileName, fileSize: current.expectedFileSize, contentType: current.contentType,
          changeSummary: current.purpose === 'CREATE_DOCUMENT' ? 'Initial upload' : current.changeSummary,
          approvalStatus: 'DRAFT', lifecycleState: 'DRAFT', submittedById: actor.id,
          submittedAt: new Date(), reviewerId: current.reviewerId
        }
      });
      if (current.purpose === 'CREATE_VERSION') {
        await tx.sopDocument.update({ where: { id: document.id }, data: { status: 'DRAFT', currentVersion: current.versionNo } });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id, entity: 'SopDocument', entityId: document.id,
          action: current.purpose === 'CREATE_DOCUMENT' ? 'CREATE_DRAFT' : 'CREATE_DRAFT_VERSION',
          detail: JSON.stringify({ version: version.versionNo, fileName: version.fileName, submittedById: actor.id, reviewerId: current.reviewerId, uploadSessionId: current.id })
        }
      });
      await tx.googleDriveUploadSession.update({
        where: { id: current.id },
        data: { status: 'COMPLETED', sopDocumentId: document.id, sopVersionId: version.id, completedAt: new Date() }
      });
      return { session: { ...current, sopDocumentId: document.id }, version, reviewer };
    }, { isolationLevel: 'Serializable' });
    return completedDto(result.session, result.version, result.reviewer);
  } catch (error) {
    await db.googleDriveUploadSession.updateMany({
      where: { id: session.id, status: 'FINALIZING' },
      data: { status: error instanceof DirectUploadError && error.code === 'INVALID_UPLOAD' ? 'FAILED' : 'PENDING', googleDriveFileId: null }
    }).catch(() => undefined);
    throw error;
  }
}
