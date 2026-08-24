import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// Home is a dedicated React page (app/page.js), not the static hub asset.
// These assertions match the pattern already established for Refinement in
// test/ai-refinement-workbench.test.mjs.

test("the root page no longer renders the static hub asset", async () => {
  const source = await read("../app/page.js");
  assert.doesNotMatch(source, /procurement-governance-hub\.html/);
  assert.match(source, /import HomeDashboard from '\.\/home\/home-dashboard'/);
});

test("the approved hub interface asset is unchanged by the Home conversion", async () => {
  const [source, published] = await Promise.all([
    read("../procurement-governance-hub (1).html"),
    read("../public/procurement-governance-hub.html"),
  ]);
  assert.equal(source, published, "the published hub asset must stay a byte-identical copy of its source");
});

test("quick actions restricted to governance roles are hidden for other roles", async () => {
  const source = await read("../app/home/home-dashboard.js");
  assert.match(source, /roles: \['SUPER_USER', 'CORPORATE_GOVERNANCE'\]/);
  assert.match(source, /!action\.roles \|\| action\.roles\.includes\(role\)/);
});

test("the engagement dashboard renders the Business-Unit-scoped view for a Business Unit viewer, not the cross-BU ranking", async () => {
  const source = await read("../app/home/home-dashboard.js");
  assert.match(source, /isBU = payload\.viewer\?\.role === 'BUSINESS_UNIT_PIC'/);
  assert.match(source, /if \(isBU\) \{/);
});

test("the engagement dashboard calls the real API rather than inventing figures", async () => {
  const source = await read("../app/home/home-dashboard.js");
  assert.match(source, /fetch\('\/api\/engagement'\)/);
});

test("a failed engagement fetch degrades to an honest message rather than a crash", async () => {
  const source = await read("../app/home/home-dashboard.js");
  assert.match(source, /belum dapat dimuat\. Silakan refresh halaman\./);
});

test("SVG donut coordinates are rounded to avoid a server/client hydration mismatch", async () => {
  // Math.cos/Math.sin can differ in their last float bit between the Node
  // and browser JS engines; unrounded coordinates make the SSR-ed path `d`
  // attribute mismatch the client re-render and trip a permanent React
  // hydration warning for a sub-pixel difference. Verified live in the
  // browser (console had zero errors after this fix, versus a hydration
  // warning before it).
  const source = await read("../app/home/home-dashboard.js");
  assert.match(source, /const round = \(n\) => Math\.round\(n \* 10_000\) \/ 10_000;/);
  assert.match(source, /round\(cx \+ r \* Math\.cos\(rad\)\), round\(cy \+ r \* Math\.sin\(rad\)\)/);
});

test("the hero carousel auto-rotates and cleans up its interval on unmount", async () => {
  const source = await read("../app/home/home-dashboard.js");
  assert.match(source, /setInterval\(\(\) => setIndex/);
  assert.match(source, /return \(\) => clearInterval\(timer\);/);
});
