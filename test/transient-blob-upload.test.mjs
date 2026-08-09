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
  assert.match(service, /File upload sementara tidak ditemukan\. Mulai upload kembali\./);
  assert.match(migration, /transientBlobPath/);
  assert.match(migration, /failureReason/);
  assert.match(indexes, /one_active_document_key/);
  assert.match(indexes, /'UPLOADED'/);
});

test('the transfer task is registered separately from the browser upload path', async () => {
  const task = await readFile(new URL('../trigger/sop-blob-transfer.ts', import.meta.url), 'utf8');
  const completeRoute = await readFile(new URL('../app/api/documents/direct-upload-sessions/[sessionId]/complete/route.js', import.meta.url), 'utf8');

  assert.match(task, /id: 'sop-blob-transfer'/);
  assert.match(task, /transferBlobUploadToGoogleDrive/);
  assert.match(completeRoute, /sopBlobTransfer\.trigger/);
  assert.match(completeRoute, /status: result\.session\.status/);
});
