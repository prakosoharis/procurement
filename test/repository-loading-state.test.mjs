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

test('The dynamic hub route uses the static asset version containing the current Repository master-data flow', async () => {
  // Home (app/page.js) is a React page and no longer renders the static
  // asset at all -- it is intentionally not checked here. Repository,
  // Calendar, Engagement, Insights, People, and Directory are still served
  // through app/hub/[page]/page.js as those pages are converted one at a
  // time; this guards against that route silently serving a stale cached
  // copy of the asset in the meantime.
  const { readFile } = await import('node:fs/promises');
  const hub = await readFile(new URL('../app/hub/[page]/page.js', import.meta.url), 'utf8');
  assert.match(hub, /v=20260810-05/);
});
