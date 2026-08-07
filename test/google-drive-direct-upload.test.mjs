import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleDriveResumableUpload } from '../lib/google-drive.js';
import { driveFileMatchesSession, validateUploadMetadata } from '../lib/document-direct-upload-service.js';

test('Google Drive resumable session is initiated server-side and exposes only a short-lived upload URL', async () => {
  let request;
  const result = await createGoogleDriveResumableUpload({
    name: 'Policy — v1.0 — policy.pdf',
    parentId: 'folder-1',
    contentType: 'application/pdf',
    contentLength: 123,
    appProperties: { procurementUploadSessionId: 'session-1' },
    getClient: async () => ({ auth: { getAccessToken: async () => ({ token: 'server-token' }) } }),
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response('', { status: 200, headers: { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=abc' } });
    }
  });

  assert.equal(result.uploadUrl, 'https://www.googleapis.com/upload/drive/v3/files?upload_id=abc');
  assert.equal(request.options.headers['X-Upload-Content-Length'], '123');
  assert.deepEqual(JSON.parse(request.options.body), {
    name: 'Policy — v1.0 — policy.pdf', parents: ['folder-1'], appProperties: { procurementUploadSessionId: 'session-1' }
  });
  assert.equal('accessToken' in result, false);
});
test('Google Drive resumable initiation rejects an untrusted or absent upload URL', async () => {
  await assert.rejects(() => createGoogleDriveResumableUpload({
    name: 'policy.pdf', parentId: 'folder-1', contentType: 'application/pdf', contentLength: 1,
    appProperties: {}, getClient: async () => ({ auth: { getAccessToken: async () => 'token' } }),
    fetchImpl: async () => new Response('', { status: 200, headers: { location: 'https://example.test/upload' } })
  }), /sesi upload yang valid/);
});

test('direct document upload metadata only permits supported files within the product limit', () => {
  assert.deepEqual(validateUploadMetadata({ fileName: 'policy.pdf', contentType: 'application/pdf', fileSize: 1024 }), {
    fileName: 'policy.pdf', contentType: 'application/pdf', fileSize: 1024, changeSummary: null
  });
  assert.throws(() => validateUploadMetadata({ fileName: 'x.exe', contentType: 'application/octet-stream', fileSize: 1 }), /PDF\/DOCX/);
  assert.throws(() => validateUploadMetadata({ fileName: 'large.pdf', contentType: 'application/pdf', fileSize: 26 * 1024 * 1024 }), /PDF\/DOCX/);
});

test('completion validates the exact Drive object produced for its upload session', () => {
  const session = {
    id: 'session-1', googleDriveFileId: 'file-1', expectedDriveName: 'Policy — v1.0 — policy.pdf',
    expectedFileSize: 123, contentType: 'application/pdf', googleDriveParentId: 'folder-1'
  };
  const file = {
    id: 'file-1', name: 'Policy — v1.0 — policy.pdf', size: '123', mimeType: 'application/pdf',
    parents: ['folder-1'], appProperties: { procurementUploadSessionId: 'session-1' }, trashed: false
  };
  assert.equal(driveFileMatchesSession(file, session), true);
  assert.equal(driveFileMatchesSession({ ...file, appProperties: {} }, session), false);
  assert.equal(driveFileMatchesSession({ ...file, size: '124' }, session), false);
});
