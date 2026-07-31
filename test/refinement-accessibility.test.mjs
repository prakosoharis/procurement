import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('native shell provides a keyboard skip link and focus target', () => {
  const shell = read('app/components/native-app-shell.js');
  assert.match(shell, /skip-link/);
  assert.match(shell, /href="#native-content"/);
  assert.match(shell, /id="native-content"/);
  assert.match(shell, /tabIndex="-1"/);
});

test('Refinement queue has labelled controls, an accessible table, and workspace links', () => {
  const queue = read('app/sop-governance/refinement/refinement-queue-client.js');
  assert.match(queue, /aria-label="Refinement queue filters"/);
  assert.match(queue, /<caption className="sr-only">/);
  assert.match(queue, /scope="col"/);
  assert.match(queue, /aria-live="polite"/);
  assert.match(queue, /href=\{`\/sop-governance\/refinement/);
});

test('Refinement workspace uses labelled forms, live feedback, and colour-independent readiness text', () => {
  const workspace = read('app/sop-governance/refinement/[versionId]/page.js');
  assert.match(workspace, /role="status" aria-live="polite"/);
  assert.match(workspace, /<label>Refinement summary/);
  assert.match(workspace, /Complete:' : 'Incomplete:/);
  assert.match(workspace, /textarea required/);
});

test('Refinement styles provide visible keyboard focus and responsive cards/toolbar', () => {
  const styles = read('app/globals.css');
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /\.repository-card/);
  assert.match(styles, /\.repository-toolbar/);
  assert.match(styles, /@media \(max-width: 800px\)/);
});
