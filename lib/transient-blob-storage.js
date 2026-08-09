import { del, get, head } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

const TRANSIENT_PREFIX = 'procurement-governance-hub/transient-sop-uploads';

export class TransientUploadStorageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TransientUploadStorageError';
  }
}

function token() {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) {
    throw new TransientUploadStorageError('Vercel Blob belum dikonfigurasi. Tambahkan BLOB_READ_WRITE_TOKEN pada environment aplikasi dan Trigger.dev.');
  }
  return value;
}

function safeFileName(value) {
  return String(value || 'document')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180) || 'document';
}

export function transientBlobPath(sessionId, fileName) {
  return `${TRANSIENT_PREFIX}/${sessionId}/${safeFileName(fileName)}`;
}

export async function createTransientUploadUrl({ sessionId, fileName, contentType, fileSize, expiresAt }) {
  const pathname = transientBlobPath(sessionId, fileName);
  const validUntil = Math.min(new Date(expiresAt).getTime(), Date.now() + (15 * 60 * 1000));
  const clientToken = await generateClientTokenFromReadWriteToken({
    token: token(),
    pathname,
    validUntil,
    allowedContentTypes: [contentType],
    maximumSizeInBytes: fileSize,
    allowOverwrite: false,
    addRandomSuffix: false
  });
  return {
    pathname,
    clientToken,
    expiresAt: new Date(validUntil).toISOString()
  };
}

export async function inspectTransientUpload(pathname) {
  if (!pathname) throw new TransientUploadStorageError('Lokasi upload sementara tidak tersedia.');
  return head(pathname, { token: token() });
}

export async function readTransientUpload(pathname) {
  if (!pathname) throw new TransientUploadStorageError('Lokasi upload sementara tidak tersedia.');
  const result = await get(pathname, { access: 'private', token: token(), useCache: false });
  if (!result?.stream) throw new TransientUploadStorageError('File upload sementara tidak ditemukan. Mulai upload kembali.');
  return result;
}

export async function deleteTransientUpload(pathname) {
  if (!pathname) return;
  await del(pathname, { token: token() });
}
