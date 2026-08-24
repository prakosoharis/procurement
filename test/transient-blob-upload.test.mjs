import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transientBlobPath } from '../lib/transient-blob-storage.js';

test('transient Blob pathname is constrained to one upload session and a safe filename', () => {
  assert.equal(
    transientBlobPath('session-123', '../Policy 2026.pdf'),
    'procurement-governance-hub/transient-sop-uploads/session-123/_Policy_2026.pdf'
  );
});

test('Blob-to-Drive service validates the transit object and only creates the SOP after worker transfer', async () => {
  const service = await readFile(new URL('../lib/document-direct-upload-service.js', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../prisma/migrations/20260810000000_add_transient_blob_uploads/migration.sql', import.meta.url), 'utf8');
  const indexes = await readFile(new URL('../prisma/migrations/20260810000100_expand_active_upload_session_locks/migration.sql', import.meta.url), 'utf8');

  assert.match(service, /inspectTransientUpload/);
  assert.match(service, /BLOB_VISIBILITY_RETRY_DELAYS_MS/);
  assert.match(service, /inspectUploadedBlob/);
  assert.match(service, /blobMatchesSession/);
  assert.match(service, /status: 'UPLOADED'/);
  assert.match(service, /status: 'TRANSFERRING'/);
  assert.match(service, /Readable\.fromWeb\(blob\.stream\)/);
  assert.match(service, /status: 'COMPLETED'/);
  assert.match(service, /deleteTransientUpload/);
  assert.match(service, /cancelPendingDirectUpload/);
  assert.match(service, /resumePendingUploadSession/);
  assert.match(service, /alreadyUploaded: true/);
  assert.match(service, /short-lived token[\s\S]*same pending session/);
  assert.match(service, /Upload dibatalkan sebelum file diterima\./);
  assert.match(service, /File upload sementara tidak ditemukan\. Mulai upload kembali\./);
  assert.match(migration, /transientBlobPath/);
  assert.match(migration, /failureReason/);
  assert.match(indexes, /one_active_document_key/);
  assert.match(indexes, /'UPLOADED'/);
});

test('the browser receives a narrowly scoped client token for the private Blob upload', async () => {
  const storage = await readFile(new URL('../lib/transient-blob-storage.js', import.meta.url), 'utf8');
  const service = await readFile(new URL('../lib/document-direct-upload-service.js', import.meta.url), 'utf8');
  // The Repository React page runs at the top level (no iframe), so it calls
  // @vercel/blob/client's put() directly instead of bouncing through the old
  // iframe/postMessage bridge -- see app/hub/repository/repository-api.js.
  const client = await readFile(new URL('../app/hub/repository/repository-api.js', import.meta.url), 'utf8');

  assert.match(storage, /generateClientTokenFromReadWriteToken/);
  assert.match(storage, /allowedContentTypes: \[contentType\]/);
  assert.match(storage, /maximumSizeInBytes: fileSize/);
  assert.match(storage, /allowOverwrite: false/);
  assert.match(service, /uploadToken: upload\.clientToken/);
  assert.match(service, /transientBlobPath: session\.transientBlobPath/);
  assert.match(client, /import \{ put \} from '@vercel\/blob\/client'/);
  assert.match(client, /access: 'private'/);
  assert.match(client, /token: session\.uploadToken/);
});

test('the transfer task is registered separately from the browser upload path', async () => {
  const task = await readFile(new URL('../trigger/sop-blob-transfer.ts', import.meta.url), 'utf8');
  const completeRoute = await readFile(new URL('../app/api/documents/direct-upload-sessions/[sessionId]/complete/route.js', import.meta.url), 'utf8');

  assert.match(task, /id: 'sop-blob-transfer'/);
  assert.match(task, /transferBlobUploadToGoogleDrive/);
  assert.match(completeRoute, /sopBlobTransfer\.trigger/);
  assert.match(completeRoute, /status: result\.session\.status/);
});

test('only the creator may cancel a pending browser upload session', async () => {
  const route = await readFile(new URL('../app/api/documents/direct-upload-sessions/[sessionId]/route.js', import.meta.url), 'utf8');

  assert.match(route, /export async function DELETE/);
  assert.match(route, /cancelPendingDirectUpload/);
});
