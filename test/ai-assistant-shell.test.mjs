import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { AiFeatureFlag, isAiFeatureEnabled } from "../lib/ai/feature-flags.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// The assistant lives in the React shell. These assertions keep it there: the
// approved hub interface asset must stay untouched by AI work.

test("the approved hub interface asset is unchanged by the assistant", async () => {
  const [source, published] = await Promise.all([
    read("../procurement-governance-hub (1).html"),
    read("../public/procurement-governance-hub.html"),
  ]);
  assert.equal(source, published, "the published hub asset must stay a byte-identical copy of its source");
  for (const html of [source, published]) {
    assert.doesNotMatch(html, /AssistantPanel/);
    assert.doesNotMatch(html, /\/api\/ai\//);
  }
});

test("every hub page mounts the assistant behind the flag and the permission (except Insights, which is the assistant's own full-page form)", async () => {
  const pages = [
    "../app/page.js",
    "../app/hub/calendar/page.js",
    "../app/hub/engagement/page.js",
    "../app/hub/directory/page.js",
    "../app/hub/people/page.js",
    "../app/hub/repository/page.js",
    "../app/hub/requests/page.js",
    "../app/hub/refinement/page.js",
  ];
  for (const path of pages) {
    const source = await read(path);
    assert.match(source, /import AssistantPanel from/, path);
    assert.match(source, /isAiFeatureEnabled\(AiFeatureFlag\.CHAT\)\s*&&\s*can\(user, Permission\.COPILOT_USE\)\s*&&\s*<AssistantPanel mode=\{aiConfig\(\)\.chatMode\} \/>/, path);
  }
});

test("the assistant panel never renders a provider credential or provider name", async () => {
  const source = await read("../app/components/assistant-panel.js");
  assert.doesNotMatch(source, /ANTHROPIC|API_KEY|OAUTH|sk-ant/i);
  // The panel talks to the application endpoint only, never to a provider.
  assert.match(source, /fetch\('\/api\/ai\/chat'/);
  assert.doesNotMatch(source, /anthropic\.com|api\.anthropic/i);
});

test("a deterministic answer is labelled so it is never read as AI analysis", async () => {
  const source = await read("../app/components/assistant-panel.js");
  assert.match(source, /mode !== 'DATA_SUMMARY'/);
  assert.match(source, /tanpa AI/);
  assert.match(source, /<ModeBadge mode=\{turn\.mode\} \/>/);
});

test("the panel surfaces the server's safe message rather than a raw error", async () => {
  const source = await read("../app/components/assistant-panel.js");
  assert.match(source, /payload\.message \|\| 'Layanan AI sedang tidak tersedia/);
  assert.match(source, /dataAvailable === false/);
});

test("turning the chat flag off hides the assistant", () => {
  assert.equal(isAiFeatureEnabled(AiFeatureFlag.CHAT, { AI_CHAT_ENABLED: "false" }), false);
  assert.equal(isAiFeatureEnabled(AiFeatureFlag.CHAT, { AI_CHAT_ENABLED: "off" }), false);
  assert.equal(isAiFeatureEnabled(AiFeatureFlag.CHAT, {}), true);
  assert.equal(isAiFeatureEnabled(AiFeatureFlag.REFINEMENT, { AI_REFINEMENT_ENABLED: "0" }), false);
});

test("the panel threads a server-assigned conversationId across turns rather than starting a fresh conversation each time", async () => {
  const source = await read("../app/components/assistant-panel.js");
  assert.match(source, /conversationId: conversationIdRef\.current/);
  assert.match(source, /conversationIdRef\.current = payload\.conversationId/);
});
