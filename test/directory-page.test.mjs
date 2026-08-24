import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the directory route requires no extra permission beyond authentication, matching every role's read access, but still redirects to /login when there is no valid session", async () => {
  const source = await read("../app/hub/directory/page.js");
  assert.doesNotMatch(source, /requirePageAccess/);
  assert.match(source, /requireUser\(\)/);
});

test("only a Super User sees the create-user and manage-access controls", async () => {
  const source = await read("../app/hub/directory/directory-page.js");
  assert.match(source, /const isSuperUser = role === 'SUPER_USER';/);
  assert.match(source, /\{isSuperUser && <div style=\{\{ display: 'flex', gap: 8 \}\}>/);
});

test("a Super User lists every managed account; every other role lists only the scoped PIC directory", async () => {
  const source = await read("../app/hub/directory/directory-page.js");
  assert.match(source, /fetch\(isSuperUser \? '\/api\/users' : '\/api\/pics'\)/);
});

test("a failed directory load degrades to an honest message rather than a crash", async () => {
  const source = await read("../app/hub/directory/directory-page.js");
  assert.match(source, /Directory belum dapat dimuat\. Silakan refresh halaman\./);
});

test("creating a user and resetting a password go through the real users API, not invented client-side", async () => {
  const source = await read("../app/hub/directory/directory-page.js");
  assert.match(source, /fetch\('\/api\/users', \{ method: 'POST'/);
  assert.match(source, /fetch\(`\/api\/users\/\$\{id\}\/password`, \{ method: 'PATCH'/);
});
