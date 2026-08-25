import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// middleware.js only checks that the session cookie is PRESENT, not that it
// is still valid -- an expired (8h) or tampered token passes middleware
// untouched. Every page must therefore treat a null currentUser() as
// unauthenticated and redirect to /login itself, rather than silently
// falling back to a fake role (see lib/authorization/require-user.js).

test("requireUser() redirects to /login when there is no session, exactly like requirePageAccess()", async () => {
  const source = await read("../lib/authorization/require-user.js");
  assert.match(source, /export async function requireUser\(\) \{\s*const user = await currentUser\(\);\s*if \(!user\) redirect\('\/login'\);\s*return user;\s*\}/);
});

test("no page.js calls currentUser() directly -- every one goes through requireUser() or requirePageAccess(), both of which redirect on a missing/expired session", async () => {
  const pages = [
    "../app/page.js",
    "../app/hub/calendar/page.js",
    "../app/hub/engagement/page.js",
    "../app/hub/directory/page.js",
    "../app/hub/people/page.js",
    "../app/hub/repository/page.js",
    "../app/hub/requests/page.js",
    "../app/hub/refinement/page.js",
    "../app/hub/insights/page.js",
  ];
  for (const path of pages) {
    const source = await read(path);
    assert.doesNotMatch(source, /await currentUser\(\)/, `${path} must not call currentUser() directly -- it silently falls back to a fake role instead of redirecting an expired session`);
    assert.match(source, /await require(User|PageAccess)\(/, path);
  }
});

test("pages with no specific permission (Home, Calendar, Engagement, Directory) still require a session via requireUser()", async () => {
  const pages = ["../app/page.js", "../app/hub/calendar/page.js", "../app/hub/engagement/page.js", "../app/hub/directory/page.js"];
  for (const path of pages) {
    const source = await read(path);
    assert.match(source, /requireUser\(\)/, path);
  }
});
