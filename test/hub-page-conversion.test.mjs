import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("every hub page has migrated off the static asset: the dynamic iframe fallback route no longer exists", async () => {
  await assert.rejects(access(new URL("../app/hub/[page]", import.meta.url)));
});

test("the approved hub interface asset stays byte-identical to its published copy, even though nothing renders it anymore", async () => {
  const [source, published] = await Promise.all([
    read("../procurement-governance-hub (1).html"),
    read("../public/procurement-governance-hub.html"),
  ]);
  assert.equal(source, published, "the published hub asset must stay a byte-identical copy of its source");
});
