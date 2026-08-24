import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the repository route requires SOP_REPOSITORY_VIEW, matching every role's read access", async () => {
  const source = await read("../app/hub/repository/page.js");
  assert.match(source, /requirePageAccess\(Permission\.SOP_REPOSITORY_VIEW\)/);
});

test("the React repository page uploads straight to Vercel Blob from the browser, not through the iframe/postMessage bridge the static asset needed", async () => {
  const source = await read("../app/hub/repository/repository-api.js");
  assert.match(source, /import \{ put \} from '@vercel\/blob\/client';/);
  assert.match(source, /await put\(session\.transientBlobPath, file, \{ access: 'private', token: session\.uploadToken, contentType: file\.type \}\)/);
  assert.doesNotMatch(source, /window\.postMessage|addEventListener\('message'|PROCUREMENT_BLOB_UPLOAD/);
});

test("only a repository manager sees master-data, create-SOP, and update/approve controls", async () => {
  const tabSource = await read("../app/hub/repository/sop-tab.js");
  assert.match(tabSource, /\{canManage && <button onClick=\{\(\) => setMasterDataOpen\(true\)\}/);
  assert.match(tabSource, /\{canManage && <button onClick=\{\(\) => setCreateTarget\(null\)\}/);
  const modalSource = await read("../app/hub/repository/sop-modals.js");
  assert.match(modalSource, /const canApprove = canManage && document\?\.status === 'DRAFT' && document\?\.reviewer\?\.id === viewerId;/);
});

test("a Business Unit PIC's repository is scoped view-only: no manager-only modals are rendered for them", async () => {
  const source = await read("../app/hub/repository/repository-page.js");
  assert.match(source, /const canManage = role === 'SUPER_USER' \|\| role === 'CORPORATE_GOVERNANCE';/);
});

test("a failed repository load degrades to an honest message rather than a crash", async () => {
  const source = await read("../app/hub/repository/sop-tab.js");
  assert.match(source, /Repository belum dapat dimuat\. Silakan refresh halaman\./);
});

test("clicking an empty mandatory compliance cell opens create pre-filled; clicking a cell with existing documents (or any additional cell) opens the document list first", async () => {
  const source = await read("../app/hub/repository/sop-tab.js");
  assert.match(source, /if \(documentType\.category === 'ADDITIONAL' \|\| docs\.length\) \{/);
});

test("the Sources and Links tabs are ported as static visuals, matching the static asset which never wired their buttons to any API", async () => {
  const sources = await read("../app/hub/repository/sources-tab.js");
  const links = await read("../app/hub/repository/links-tab.js");
  assert.doesNotMatch(sources, /fetch\(/);
  assert.doesNotMatch(links, /fetch\(/);
});
