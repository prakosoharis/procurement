import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// Central tracker for the hub's page-by-page migration off the static asset.
// Update these two lists as each remaining page (repository, engagement,
// insights, people, directory) gets its own React route -- this is the only
// file that needs touching for that bookkeeping; per-page test files assert
// their own route's specific behaviour instead of duplicating this check.
const CONVERTED_TO_REACT = ["refinement", "calendar"];
const REMAINING_ON_IFRAME = ["requests", "repository", "engagement", "insights", "people", "directory"];

test("the dynamic hub iframe route no longer claims to serve a page once it has its own React route", async () => {
  const source = await read("../app/hub/[page]/page.js");
  const setLine = source.match(/const pages = new Set\(\[[^\]]*\]\);/)[0];
  for (const page of CONVERTED_TO_REACT) assert.doesNotMatch(setLine, new RegExp(`'${page}'`));
  for (const page of REMAINING_ON_IFRAME) assert.match(setLine, new RegExp(`'${page}'`));
});

test("the approved hub interface asset stays byte-identical to its published copy throughout the migration", async () => {
  const [source, published] = await Promise.all([
    read("../procurement-governance-hub (1).html"),
    read("../public/procurement-governance-hub.html"),
  ]);
  assert.equal(source, published, "the published hub asset must stay a byte-identical copy of its source");
});
