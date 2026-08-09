import test from 'node:test';
import assert from 'node:assert/strict';
import { driveFileMatchesSession, validateUploadMetadata } from '../lib/document-direct-upload-service.js';

test('direct document upload metadata only permits supported files within the product limit', () => {
  assert.deepEqual(validateUploadMetadata({ fileName: 'policy.pdf', contentType: 'application/pdf', fileSize: 1024 }), {
    fileName: 'policy.pdf', contentType: 'application/pdf', fileSize: 1024, changeSummary: null
  });
  assert.throws(() => validateUploadMetadata({ fileName: 'x.exe', contentType: 'application/octet-stream', fileSize: 1 }), /PDF\/DOCX/);
  assert.throws(() => validateUploadMetadata({ fileName: 'large.pdf', contentType: 'application/pdf', fileSize: 26 * 1024 * 1024 }), /PDF\/DOCX/);
});

test('the final Drive object guard retains strict file identity checks', () => {
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
