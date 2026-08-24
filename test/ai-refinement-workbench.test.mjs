import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// A dedicated React page for one hub screen. These assertions keep the
// blast radius exactly where it was scoped: this route only, the approved
// static hub asset and every other hub page untouched.

test("the refinement route is gated behind REFINEMENT_VIEW before any data loads", async () => {
  const source = await read("../app/hub/refinement/page.js");
  assert.match(source, /requirePageAccess\(Permission\.REFINEMENT_VIEW\)/);
});

test("the assistant panel is gated the same way as every other hub page", async () => {
  const source = await read("../app/hub/refinement/page.js");
  assert.match(source, /isAiFeatureEnabled\(AiFeatureFlag\.CHAT\)\s*&&\s*can\(user, Permission\.COPILOT_USE\)\s*&&\s*<AssistantPanel mode=\{aiConfig\(\)\.chatMode\} \/>/);
});

test("the approved hub interface asset has no reference to the AI Refinement API routes", async () => {
  const published = await read("../public/procurement-governance-hub.html");
  assert.doesNotMatch(published, /ai-runs|ai-findings/);
});

test("the workbench never renders a fake or hardcoded account menu, unlike the static hub's own header markup", async () => {
  const source = await read("../app/hub/refinement/refinement-workbench.js");
  assert.doesNotMatch(source, /Admin User/);
  assert.doesNotMatch(source, /notif-badge|notifBadge/);
  // AccountMenu is mounted once by page.js; the workbench's own header must
  // not attempt a second user-menu button.
  assert.doesNotMatch(source, /user-btn|userBtn/);
});

test("starting a new analysis and deciding a finding are restricted to governance roles client-side", async () => {
  const source = await read("../app/hub/refinement/refinement-workbench.js");
  assert.match(source, /const canManage = \(role\) => \['SUPER_USER', 'CORPORATE_GOVERNANCE'\]\.includes\(role\);/);
  assert.match(source, /canManage\(role\) \? <div[^>]*>\s*<StartRunForm/);
  assert.match(source, /canManage\(role\) && finding\.humanStatus === 'PENDING' && <DecisionForm/);
});

test("a native checkbox and radio input are reset against the leftover globals.css element selectors", async () => {
  // app/layout.js imports globals.css globally; its `input,select,textarea`
  // rule sets width:100%/padding:9px/border/background on every native input.
  // That is harmless for text inputs and textareas (fully covered by inline
  // styles below), but turns a checkbox or radio into a stray box unless
  // explicitly reset. Verified visually in the browser; this locks it in.
  const source = await read("../app/hub/refinement/refinement-workbench.js");
  const checkboxBlock = source.slice(source.indexOf('type="checkbox"'), source.indexOf('type="checkbox"') + 260);
  const radioBlock = source.slice(source.indexOf('type="radio"'), source.indexOf('type="radio"') + 260);
  for (const block of [checkboxBlock, radioBlock]) {
    assert.match(block, /width: 1[46]/);
    assert.match(block, /padding: 0/);
  }
});

test("run and finding data is read through the AI run APIs, not invented client-side", async () => {
  const source = await read("../app/hub/refinement/refinement-workbench.js");
  assert.match(source, /fetch\(`\/api\/governance\/refinement\/\$\{versionId\}\/ai-runs`\)/);
  assert.match(source, /fetch\(`\/api\/governance\/refinement\/\$\{selectedVersionId\}\/ai-runs\/\$\{run(Id|\.id)?\}`\)/);
  assert.match(source, /fetch\(`\/api\/governance\/refinement\/ai-findings\/\$\{findingId\}\/decision`/);
});

test("a decision refreshes the run's detail endpoint rather than the findings-less list endpoint", async () => {
  // Regression lock: the list endpoint's rows have no `findings` field, so
  // replacing state with it after a decision made every finding in an
  // expanded run vanish instead of showing its updated status. Verified live
  // in the browser and fixed by refetching this run's detail specifically.
  const source = await read("../app/hub/refinement/refinement-workbench.js");
  const decideFn = source.slice(source.indexOf("async function decide("), source.indexOf("async function decide(") + 800);
  assert.match(decideFn, /await loadRunDetail\(runId\)/);
  assert.doesNotMatch(decideFn, /await loadRuns\(/);
});

test("an offline-generated run is labelled distinctly rather than presented as a live result", async () => {
  const source = await read("../app/hub/refinement/refinement-workbench.js");
  assert.match(source, /run\.generatedOffline && <Badge tone="blue">Hasil offline/);
});

test("only approved reference sources can be selected to start a run", async () => {
  const source = await read("../app/hub/refinement/refinement-workbench.js");
  assert.match(source, /sources\.filter\(\(source\) => source\.isApproved\)/);
});

test("the product decision vocabulary sent to the API matches the decision route's accepted values", async () => {
  const source = await read("../app/hub/refinement/refinement-workbench.js");
  assert.match(source, /\['VALID', 'Valid'\], \['REVISI', 'Revisi'\], \['ABAIKAN', 'Abaikan'\]/);
});

test("a REVISI or ABAIKAN decision requires a comment before the form can submit", async () => {
  const source = await read("../app/hub/refinement/refinement-workbench.js");
  assert.match(source, /needsComment = decision !== 'VALID'/);
  assert.match(source, /needsComment && <textarea required/);
  assert.match(source, /needsModified = decision === 'REVISI'/);
  assert.match(source, /needsModified && <textarea required/);
});
