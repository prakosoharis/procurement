import test from 'node:test';
import assert from 'node:assert/strict';

test('Repository begins empty and renders only a loading state until database data arrives', async () => {
  const { readFile } = await import('node:fs/promises');
  const ui = await readFile(new URL('../procurement-governance-hub (1).html', import.meta.url), 'utf8');

  assert.match(ui, /var sopData=\[\],mandatoryDocuments=\[\],additionalDocuments=\[\],repositoryUnits=\[\];/);
  assert.match(ui, /var liveRepositoryLoaded=false,repositoryLoadState='loading',repositoryLoadPromise=null/);
  assert.match(ui, /setRepositoryLoading\(\)/);
  assert.match(ui, /fetch\('\/api\/repository-overview',\{cache:'no-store'\}\)/);
  assert.match(ui, /if\(!liveRepositoryLoaded\)\{if\(repositoryLoadState==='error'\)setRepositoryLoadError\(\);else setRepositoryLoading\(\);return\}/);
  assert.doesNotMatch(ui, /SOP Proses Tender Terbuka NANOVEST/);
});

test('Top-level pages use a new static asset version after the Repository loading fix', async () => {
  const { readFile } = await import('node:fs/promises');
  const [home, hub] = await Promise.all([
    readFile(new URL('../app/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/hub/[page]/page.js', import.meta.url), 'utf8')
  ]);
  assert.match(home, /v=20260805-01/);
  assert.match(hub, /v=20260805-01/);
});
