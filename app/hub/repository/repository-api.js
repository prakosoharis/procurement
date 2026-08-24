// Plain-JSON API helpers plus the direct-to-Blob SOP upload pipeline. Unlike
// the static hub asset -- which runs inside an iframe and has to bounce the
// actual Vercel Blob put() call through app/components/blob-upload-bridge.js
// via postMessage to the parent window -- this page runs at the top level,
// so it calls @vercel/blob/client's put() directly. See
// lib/document-direct-upload-service.js for the server-side counterpart of
// every step below.
import { put } from '@vercel/blob/client';

export async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Permintaan gagal.');
  return payload;
}

export const documentFileUrl = (fileKey, inline) => `/api/files/download?key=${encodeURIComponent(fileKey)}${inline ? '&mode=inline' : ''}`;

export const fmtDate = (value) => value ? new Date(value).toLocaleDateString('id-ID') : '—';

export const STATUS_TONE = { Draft: 'amber', Approved: 'green', Archived: 'muted' };

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function directUploadJson(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return readJson(response);
}

async function directUploadStatus(sessionId) {
  const response = await fetch(`/api/documents/direct-upload-sessions/${encodeURIComponent(sessionId)}`);
  return readJson(response);
}

async function cancelPendingDirectUpload(sessionId) {
  await fetch(`/api/documents/direct-upload-sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }).catch(() => null);
}

async function waitForGoogleDriveTransfer(sessionId, onProgress) {
  for (let attempt = 0; attempt < 60; attempt++) {
    await delay(1500);
    const status = await directUploadStatus(sessionId);
    if (status.status === 'COMPLETED') return status;
    if (status.status === 'FAILED' || status.status === 'EXPIRED') throw new Error(status.message || 'Pemindahan file ke Google Drive gagal. Coba upload kembali.');
    if (onProgress) onProgress(status);
  }
  throw new Error('Pemindahan ke Google Drive masih berlangsung. Muat ulang Repository untuk memeriksa hasilnya.');
}

// prepareUrl: '/api/documents/direct-upload-sessions' (create) or
// '/api/documents/{id}/direct-upload-sessions' (new version).
export async function directSopUpload({ prepareUrl, file, metadata, onStatus }) {
  let session = null;
  let completionAccepted = false;
  try {
    onStatus?.('Menyiapkan upload...');
    session = await directUploadJson(prepareUrl, metadata);

    if (!session.alreadyUploaded) {
      onStatus?.('Mengunggah file...');
      await put(session.transientBlobPath, file, { access: 'private', token: session.uploadToken, contentType: file.type });
    } else {
      onStatus?.('Melanjutkan upload sebelumnya...');
    }

    onStatus?.('Memindahkan ke Google Drive...');
    await directUploadJson(`/api/documents/direct-upload-sessions/${encodeURIComponent(session.sessionId)}/complete`, {});
    completionAccepted = true;

    return await waitForGoogleDriveTransfer(session.sessionId, (status) => onStatus?.(status.status === 'TRANSFERRING' ? 'Menyimpan ke Google Drive...' : 'Menunggu Google Drive...'));
  } catch (error) {
    if (session && !completionAccepted) await cancelPendingDirectUpload(session.sessionId);
    throw error;
  }
}
