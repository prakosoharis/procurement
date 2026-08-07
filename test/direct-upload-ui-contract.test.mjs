import test from 'node:test';
import assert from 'node:assert/strict';

test('Repository SOP forms upload file bytes directly to Google Drive instead of posting multipart data to Vercel', async () => {
  const { readFile } = await import('node:fs/promises');
  const ui = await readFile(new URL('../procurement-governance-hub (1).html', import.meta.url), 'utf8');

  assert.match(ui, /function uploadFileToGoogleDrive\(file,session,onProgress\)/);
  assert.match(ui, /'Content-Range':'bytes '\+offset\+'-'\+end\+'\/'\+total/);
  assert.match(ui, /prepareUrl:'\/api\/documents\/direct-upload-sessions'/);
  assert.match(ui, /encodeURIComponent\(session\.sessionId\).*complete/);
  assert.match(ui, /encodeURIComponent\(raw\).*direct-upload-sessions/);
  assert.doesNotMatch(ui, /fetch\('\/api\/documents',\{method:'POST',body:data\}\)/);
  assert.doesNotMatch(ui, /fetch\('\/api\/documents\/\'+raw\+'\/versions',\{method:'POST',body:formData\}\)/);
});
