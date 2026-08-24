import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// The approved static hub hides the Directory nav link for Business Unit
// PICs ([data-directory-menu], applyDashboardRole()); the page itself stays
// reachable by URL for that role, only the link is hidden. Every React page
// using HubHeader must thread role through so this stays true post-migration.
test("HubHeader hides the Directory nav link for a Business Unit PIC", async () => {
  const source = await read("../app/hub/_shared/hub-header.js");
  assert.match(source, /key !== 'directory' \|\| role !== 'BUSINESS_UNIT_PIC'/);
});

test("every converted hub page threads its viewer's role into HubHeader", async () => {
  const files = [
    "../app/home/home-dashboard.js",
    "../app/hub/calendar/calendar-page.js",
    "../app/hub/engagement/engagement-page.js",
    "../app/hub/insights/insights-page.js",
    "../app/hub/refinement/refinement-workbench.js",
    "../app/hub/directory/directory-page.js",
    "../app/hub/people/people-page.js",
  ];
  for (const file of files) {
    const source = await read(file);
    const calls = source.match(/<HubHeader[^>]*\/>/g) || [];
    assert.ok(calls.length > 0, `${file} renders no HubHeader`);
    for (const call of calls) assert.match(call, /role=\{role\}/, `${file}: ${call}`);
  }
});
