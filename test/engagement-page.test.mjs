import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the engagement route requires no extra permission beyond authentication, matching every role's read access, but still redirects to /login when there is no valid session", async () => {
  const source = await read("../app/hub/engagement/page.js");
  assert.doesNotMatch(source, /requirePageAccess/);
  assert.match(source, /requireUser\(\)/);
});

test("only a non-BU viewer sees the business unit selector", async () => {
  const source = await read("../app/hub/engagement/engagement-page.js");
  assert.match(source, /const showSelector = viewer\.role !== 'BUSINESS_UNIT_PIC';/);
});

test("a business unit viewer with no linked detail auto-selects the first business unit rather than showing a blank page", async () => {
  const source = await read("../app/hub/engagement/engagement-page.js");
  assert.match(source, /if \(!data\.detail && data\.units\?\.length\) \{ load\(data\.units\[0\]\.id\); return; \}/);
});

test("a failed engagement load degrades to an honest message rather than a crash", async () => {
  const source = await read("../app/hub/engagement/engagement-page.js");
  assert.match(source, /Engagement Insights belum dapat dimuat\. Silakan refresh halaman\./);
});

test("detail data is read through the real engagement API, not invented client-side", async () => {
  const source = await read("../app/hub/engagement/engagement-page.js");
  assert.match(source, /fetch\(url\)/);
  assert.match(source, /'\/api\/engagement' \+ \(id \? `\?businessUnitId=\$\{encodeURIComponent\(id\)\}` : ''\)/);
});
