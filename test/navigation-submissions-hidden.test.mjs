import test from 'node:test';
import assert from 'node:assert/strict';

test('Submissions is not rendered as a top-level menu for any role', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../procurement-governance-hub (1).html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /<a[^>]*data-page="requests"[^>]*>Submissions<\/a>/);
  assert.doesNotMatch(html, /data-request-menu>Submissions/);
});
