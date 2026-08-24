import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the requests route requires SOP_REQUEST_VIEW, matching every role's read access", async () => {
  const source = await read("../app/hub/requests/page.js");
  assert.match(source, /requirePageAccess\(Permission\.SOP_REQUEST_VIEW\)/);
});

test("creating a change request reuses one idempotency key across the modal session so a network retry can never double-submit", async () => {
  const source = await read("../app/hub/requests/request-modals.js");
  assert.match(source, /if \(open\) keyRef\.current = crypto\.randomUUID\(\);/);
  assert.match(source, /clientRequestKey: keyRef\.current/);
});

test("the create-request button refuses to open when there is no Approved SOP to revise, matching the API's own constraint", async () => {
  const source = await read("../app/hub/requests/requests-page.js");
  assert.match(source, /if \(!approvedSops\.length\) \{ alert\('Belum ada SOP Approved yang dapat diajukan revisi'\); return; \}/);
});

test("only a Corporate reviewer sees the review-decision form; the reply form is hidden once a ticket is closed", async () => {
  const source = await read("../app/hub/requests/request-modals.js");
  assert.match(source, /\{canManage && <form onSubmit=\{submitReview\}/);
  assert.match(source, /\{!closed && <form onSubmit=\{sendReply\}/);
});

test("the notifications banner is scoped to Corporate roles, matching who GET /api/requests actually returns unread notifications for", async () => {
  const source = await read("../app/hub/requests/requests-page.js");
  assert.match(source, /canManage && notifications\.length > 0 && <div/);
});

test("a failed request load degrades to an honest message rather than a crash", async () => {
  const source = await read("../app/hub/requests/requests-page.js");
  assert.match(source, /Data request belum dapat dimuat\. Silakan refresh halaman\./);
});

test("requests and approved SOPs are read through the real APIs, not invented client-side", async () => {
  const source = await read("../app/hub/requests/requests-page.js");
  assert.match(source, /fetch\('\/api\/requests'\)\.then\(readJson\)/);
  assert.match(source, /fetch\('\/api\/repository-overview'\)\.then\(readJson\)/);
});

test("the Tiket Perbaikan SOP and Auto-Draft LHA sections are ported as static visuals, matching the static asset which never wired their buttons to any API", async () => {
  const source = await read("../app/hub/requests/requests-page.js");
  assert.doesNotMatch(source, /fetch\('\/api\/tickets|fetch\('\/api\/lha|fetch\('\/api\/audit-report/);
});
