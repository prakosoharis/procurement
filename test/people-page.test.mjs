import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the people route requires PEOPLE_VIEW, matching the app/api/people/* routes it fronts", async () => {
  const source = await read("../app/hub/people/page.js");
  assert.match(source, /requirePageAccess\(Permission\.PEOPLE_VIEW\)/);
});

test("people API responses are read through the {ok,data,error} envelope every app/api/people/* route uses", async () => {
  const source = await read("../app/hub/people/people-api.js");
  assert.match(source, /if \(!response\.ok \|\| !payload\.ok\) throw new Error/);
});

test("only capability holders see structure-editing and assignment-management controls, not just any authenticated role", async () => {
  const source = await read("../app/hub/people/org-chart.js");
  assert.match(source, /capabilities\.canManageAssignments && <button onClick=\{openAssign\}/);
  assert.match(source, /capabilities\.canEditStructure && <>/);
});

test("a position can only be moved under a parent that isn't itself or one of its own descendants, to prevent cycles", async () => {
  const source = await read("../app/hub/people/org-chart.js");
  assert.match(source, /const excluded = useMemo\(\(\) => new Set\(\[position\.id, \.\.\.descendantIds\(index, position\.id\)\]\)/);
});

test("mutating a position or ending an assignment sends the optimistic-lock expectedUpdatedAt the API requires", async () => {
  const source = await read("../app/hub/people/org-chart.js");
  assert.match(source, /expectedUpdatedAt: node\.updatedAt/);
  assert.match(source, /expectedUpdatedAt: o\.updatedAt/);
  assert.match(source, /expectedPositionUpdatedAt: node\.updatedAt/);
});

test("org-chart search hides non-matching nodes but keeps every ancestor of a match visible and expanded", async () => {
  const source = await read("../app/hub/people/org-chart.js");
  assert.match(source, /while \(current\?\.parentId\) \{ ancestors\.add\(current\.parentId\); current = index\.byId\[current\.parentId\]; \}/);
  assert.match(source, /const isCollapsed = collapsed\.has\(node\.id\) && !forceExpanded\.has\(node\.id\);/);
});

test("only a profile-management capability holder sees create/edit/archive controls on the Profil Personel tab", async () => {
  const source = await read("../app/hub/people/profiles-tab.js");
  assert.match(source, /capabilities\.canManagePeople && <button onClick=\{\(\) => setFormMode\(\{ mode: 'create' \}\)\}/);
  assert.match(source, /capabilities\.canManagePeople && <div style=\{\{ display: 'flex', gap: 8, paddingTop: 4 \}\}>/);
});

test("the profile search is debounced client-side before hitting the real API", async () => {
  const source = await read("../app/hub/people/profiles-tab.js");
  assert.match(source, /timerRef\.current = setTimeout\(\(\) => load\(value\), 220\);/);
  assert.match(source, /peopleRequest\(`\/api\/people\/profiles\?q=\$\{encodeURIComponent\(q\)\}`\)/);
});
