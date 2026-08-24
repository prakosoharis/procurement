import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the insights route requires COPILOT_USE, matching the chat API it fronts", async () => {
  const source = await read("../app/hub/insights/page.js");
  assert.match(source, /requirePageAccess\(Permission\.COPILOT_USE\)/);
});

test("the insights route does not also mount the floating assistant panel", async () => {
  const source = await read("../app/hub/insights/page.js");
  assert.doesNotMatch(source, /import AssistantPanel|<AssistantPanel/);
});

test("a disabled AI_CHAT flag replaces the chat with an honest disabled message rather than a broken form", async () => {
  const source = await read("../app/hub/insights/insights-page.js");
  assert.match(source, /!aiEnabled \?/);
  assert.match(source, /AI Copilot sedang dinonaktifkan oleh administrator\./);
});

test("live chat is read through the real AI chat API, not invented client-side", async () => {
  const source = await read("../app/hub/insights/insights-page.js");
  assert.match(source, /fetch\('\/api\/ai\/chat', \{/);
  assert.match(source, /fetch\('\/api\/ai\/chat\/conversations'\)/);
  assert.match(source, /fetch\(`\/api\/ai\/chat\/conversations\/\$\{id\}`\)/);
});

test("viewing a past conversation is read-only: the input is disabled and no live turns are sent", async () => {
  const source = await read("../app/hub/insights/insights-page.js");
  assert.match(source, /disabled=\{viewing\}/);
  assert.match(source, /const viewing = viewingId !== null;/);
});

test("the approved hub interface asset has no reference to the AI chat conversations API", async () => {
  const published = await read("../public/procurement-governance-hub.html");
  assert.doesNotMatch(published, /ai\/chat\/conversations/);
});
