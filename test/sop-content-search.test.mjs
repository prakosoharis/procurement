import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the SopSection migration is additive, uses the 'simple' text search config (not 'english', since content is Indonesian/English regulatory text), and indexes the generated tsvector column", async () => {
  const source = await read("../prisma/migrations/20260825000000_add_sop_content_search/migration.sql");
  assert.match(source, /CREATE TABLE "SopSection"/);
  assert.match(source, /GENERATED ALWAYS AS \(to_tsvector\('simple', "text"\)\) STORED/);
  assert.match(source, /CREATE INDEX "SopSection_searchVector_idx" ON "SopSection" USING GIN \("searchVector"\)/);
  assert.match(source, /ON DELETE CASCADE/);
});

test("indexing a SOP version reuses the existing Refinement text-extraction chain rather than a second implementation", async () => {
  const source = await read("../lib/sop-content/index-service.js");
  assert.match(source, /import \{ loadDocumentPages \} from '\.\.\/ai\/refinement\/document-text\.js';/);
});

test("indexing is idempotent: existing sections for a version are replaced, not appended to, on every run", async () => {
  const source = await read("../lib/sop-content/index-service.js");
  assert.match(source, /db\.sopSection\.deleteMany\(\{ where: \{ sopVersionId \} \}\)/);
});

test("a DOCX or scanned/no-text PDF is skipped, not treated as an indexing failure -- the document keeps working everywhere else, it just has no searchable content", async () => {
  const source = await read("../lib/sop-content/index-service.js");
  assert.match(source, /if \(isAiServiceError\(error\)\) return \{ indexed: 0, skipped: true, reason: error\.code, message: error\.message \};/);
});

test("indexing is queued (not awaited/blocking) from both places a SOP version becomes official: the direct approve route and the governance publishing service", async () => {
  const approve = await read("../app/api/documents/[id]/approve/route.js");
  assert.match(approve, /sopContentIndex\.trigger\(\{sopVersionId:version\.id\}\)\.catch\(/);
  const publishing = await read("../lib/governance/publishing/publishing-service.js");
  assert.match(publishing, /sopContentIndex\.trigger\(\{sopVersionId:versionId\}\)\.catch\(/);
});

test("the sop-content retriever is registered and only searches APPROVED/PUBLISHED documents, matching the app's existing rule that a draft's content is never exposed", async () => {
  const index = await read("../lib/ai/chat/retrievers/index.js");
  assert.match(index, /'sop-content': retrieveSopContent/);
  const retriever = await read("../lib/ai/chat/retrievers/sop-content.js");
  assert.match(retriever, /WHERE d\.status IN \('APPROVED', 'PUBLISHED'\)/);
});

test("the sop-content retriever applies the same Business Unit scoping helper every other scoped retriever/route uses, not a bespoke filter", async () => {
  const source = await read("../lib/ai/chat/retrievers/sop-content.js");
  assert.match(source, /import \{ isBusinessUnitScoped, effectiveBusinessUnitIds \} from '\.\.\/\.\.\/\.\.\/authorization\/scope\.js';/);
  assert.match(source, /isBusinessUnitScoped\(actor\)/);
});

test("retrieveForTopics passes the raw question through to every retriever (only sop-content consumes it; the rest ignore the extra field)", async () => {
  const source = await read("../lib/ai/chat/retrievers/index.js");
  assert.match(source, /export async function retrieveForTopics\(\{ actor, db, topics, question, limitPerTopic \}\)/);
  const chatService = await read("../lib/ai/chat/chat-service.js");
  assert.match(chatService, /retrieveForTopics\(\{ actor, db, topics: classification\.topics, question: text \}\)/);
});

test("the scope classifier routes content-quoting questions ('isi', 'pasal', 'ayat', ...) to sop-content alongside repository, not instead of it", async () => {
  const source = await read("../lib/ai/chat/scope-classifier.js");
  assert.match(source, /'sop-content': \[/);
  assert.match(source, /'isi', 'berbunyi', 'menyebutkan'/);
});

test("the chat prompt was bumped to a new versioned file (chat.v3) rather than editing chat.v2 in place, per its own versioning convention", async () => {
  const v3 = await read("../lib/ai/prompts/chat.v3.js");
  assert.match(v3, /export const CHAT_PROMPT_VERSION = 'chat\.v3';/);
  assert.match(v3, /isi\/pasal\/ketentuan di dalam dokumen SOP/);
  const v2 = await read("../lib/ai/prompts/chat.v2.js");
  assert.match(v2, /export const CHAT_PROMPT_VERSION = 'chat\.v2';/, "chat.v2 must be left untouched as a historical version");
  const service = await read("../lib/ai/ai-service.js");
  assert.match(service, /from '\.\/prompts\/chat\.v3\.js';/);
});

test("pdfjs-dist's Node-Buffer rejection is normalized away: a real Buffer (what Buffer.concat/toBuffer produce when reading a stored file) is copied into a plain Uint8Array before reaching getDocument", async () => {
  const source = await read("../lib/refinement/pdf/searchable-pdf.js");
  assert.match(source, /const data = bytes\.constructor === Uint8Array \? bytes : new Uint8Array\(bytes\);/);
  assert.match(source, /data,\s*\n\s*disableFontFace: true/);
});

test("the backfill script only targets already-approved/published SOP versions and reuses indexSopVersion rather than re-implementing extraction", async () => {
  const source = await read("../scripts/backfill-sop-content-index.mjs");
  assert.match(source, /status: \{ in: \['APPROVED', 'PUBLISHED'\] \}/);
  assert.match(source, /import \{ indexSopVersion \} from '\.\.\/lib\/sop-content\/index-service\.js';/);
});

test("the backfill API route (for an admin to trigger from the Repository UI, since a deployment like Vercel has no shell to run the CLI script from) is manager-gated the same way document creation is, only queries versions with zero sections yet, and dispatches without waiting for a single PDF to finish parsing", async () => {
  const source = await read("../app/api/documents/backfill-sop-content-index/route.js");
  assert.match(source, /if \(!canManageBusinessUnit\(user\)\) return NextResponse\.json\(\{ error: 'You do not have access to run this\.' \}, \{ status: 403 \}\);/);
  assert.match(source, /where: \{ sopDocument: \{ status: \{ in: \['APPROVED', 'PUBLISHED'\] \} \}, sections: \{ none: \{\} \} \}/);
  assert.match(source, /sopContentIndex\.trigger\(\{ sopVersionId: version\.id \}\)\.catch\(/);
  assert.doesNotMatch(source, /await indexSopVersion/, "the route must dispatch background jobs, not run extraction inline and block the response");
});

test("the Repository UI's index button is manager-only, disabled while dispatching, and never blocks on the response body beyond the queue count", async () => {
  const source = await read("../app/hub/repository/sop-tab.js");
  assert.match(source, /\{canManage && <button onClick=\{runBackfill\} disabled=\{backfilling\}/);
  assert.match(source, /fetch\('\/api\/documents\/backfill-sop-content-index', \{ method: 'POST' \}\)/);
});

test("indexing progress is visible: a manager-gated GET reports indexed vs total approved versions, and the UI shows the count and polls it after queueing a backfill", async () => {
  const route = await read("../app/api/documents/backfill-sop-content-index/route.js");
  assert.match(route, /export async function GET\(\)/);
  assert.match(route, /if \(!canManageBusinessUnit\(user\)\) return NextResponse\.json\(\{ error: 'You do not have access to view this\.' \}, \{ status: 403 \}\);/);
  assert.match(route, /sections: \{ some: \{\} \}/);
  assert.match(route, /\{ total, indexed, pending: total - indexed \}/);

  const ui = await read("../app/hub/repository/sop-tab.js");
  assert.match(ui, /Isi dokumen ter-index: \{indexStatus\.indexed\}\/\{indexStatus\.total\} versi/);
  // Polling stops on its own: either everything pending finished, or the
  // ~2-minute cap was hit (a version that stays pending is a skipped
  // DOCX/scanned file, not a hang worth polling forever for).
  assert.match(ui, /if \(polls >= 24 \|\| \(status && status\.pending === 0\)\)/);
  assert.match(ui, /watchIndexProgress\(\);/);
});
