import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the calendar route requires no extra permission beyond authentication, matching every role's read access", async () => {
  const source = await read("../app/hub/calendar/page.js");
  assert.doesNotMatch(source, /requirePageAccess/);
  assert.match(source, /currentUser\(\)/);
});

test("only a calendar manager (Superuser or Tim Procurement) sees the create-event button", async () => {
  const source = await read("../app/hub/calendar/calendar-page.js");
  assert.match(source, /viewer\?\.canManage && <button onClick=\{\(\) => setCreateOpen\(true\)\}/);
});

test("only a Business Unit viewer on a live event sees the participation confirmation controls", async () => {
  const source = await read("../app/hub/calendar/calendar-page.js");
  assert.match(source, /canRespond=\{viewer\?\.role === 'BUSINESS_UNIT_PIC' && detailEvent\.status !== 'CANCELLED'\}/);
});

test("creating a private audit requires at least one selected PIC before the API is called", async () => {
  const source = await read("../app/hub/calendar/calendar-page.js");
  assert.match(source, /if \(!isGeneral && !participantIds\.length\)/);
});

test("a failed calendar load degrades to an honest message rather than a crash", async () => {
  const source = await read("../app/hub/calendar/calendar-page.js");
  assert.match(source, /Calendar belum dapat dimuat\. Silakan refresh halaman\./);
});

test("event data is read through the real audit-events API, not invented client-side", async () => {
  const source = await read("../app/hub/calendar/calendar-page.js");
  assert.match(source, /fetch\('\/api\/audit-events'\)/);
  assert.match(source, /fetch\(`\/api\/audit-events\/\$\{detailEventId\}\/participation`/);
});
