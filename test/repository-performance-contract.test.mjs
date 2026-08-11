import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Repository overview transfers only the latest version and exposes safe timings', async () => {
  const [route, documentDto, performance, layout] = await Promise.all([
    readFile(new URL('../app/api/repository-overview/route.js', import.meta.url), 'utf8'),
    readFile(new URL('../lib/documents.js', import.meta.url), 'utf8'),
    readFile(new URL('../lib/api-performance.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/layout.js', import.meta.url), 'utf8')
  ]);

  assert.match(route, /take:1/);
  assert.match(route, /includeVersionHistory: false/);
  assert.match(route, /scopeWhere\(user, 'businessUnit'\)/);
  assert.match(route, /startApiTiming\('\/api\/repository-overview'\)/);
  assert.match(documentDto, /includeVersionHistory = true/);
  assert.match(performance, /Server-Timing/);
  assert.match(performance, /API_PERFORMANCE_LOGGING/);
  assert.doesNotMatch(performance, /DATABASE_URL|password|token/i);
  assert.match(layout, /preferredRegion='sin1'/);
});

test('Repository loads detail history and PIC data only when the user needs it', async () => {
  const [ui, detailRoute] = await Promise.all([
    readFile(new URL('../procurement-governance-hub (1).html', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/documents/[id]/route.js', import.meta.url), 'utf8')
  ]);

  assert.match(ui, /fetch\('\/api\/documents\/'\+encodeURIComponent\(sopDocument\.id\)/);
  assert.match(ui, /if\(document\.getElementById\('directoryLiveCards'\)\)loadPics\(\)/);
  assert.match(ui, /if\(initialPage==='home'\|\|initialPage==='calendar'\)loadAuditNotifications\(\)/);
  assert.match(ui, /await loadPics\(\)/);
  assert.match(detailRoute, /versions: \{ orderBy: \{ uploadedAt: 'desc' \}, select: versionSelect \}/);
  assert.match(detailRoute, /scopeWhere\(user, 'businessUnit'\)/);
  assert.match(detailRoute, /startApiTiming\('\/api\/documents\/:id'\)/);
});
