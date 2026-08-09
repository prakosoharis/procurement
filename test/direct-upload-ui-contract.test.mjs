import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Repository SOP forms upload file bytes directly to private Vercel Blob and wait for the Drive transfer', async () => {
  const ui = await readFile(new URL('../procurement-governance-hub (1).html', import.meta.url), 'utf8');

  assert.match(ui, /function uploadFileToVercelBlob\(file,session,onProgress\)/);
  assert.match(ui, /type:'PROCUREMENT_BLOB_UPLOAD'/);
  assert.match(ui, /uploadToken:session\.uploadToken/);
  assert.match(ui, /type!=='PROCUREMENT_BLOB_UPLOAD_RESULT'/);
  assert.match(ui, /function waitForGoogleDriveTransfer\(sessionId,onProgress\)/);
  assert.match(ui, /encodeURIComponent\(session\.sessionId\)\+'\/complete'/);
  assert.match(ui, /status\.status==='COMPLETED'/);
  assert.match(ui, /prepareUrl:'\/api\/documents\/direct-upload-sessions'/);
  assert.match(ui, /encodeURIComponent\(raw\).*direct-upload-sessions/);
  assert.doesNotMatch(ui, /function uploadFileToGoogleDrive/);
  assert.doesNotMatch(ui, /Content-Range':'bytes/);
});
