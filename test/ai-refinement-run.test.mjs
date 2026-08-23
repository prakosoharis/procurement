import assert from "node:assert/strict";
import test from "node:test";
import { buildRefinementContext } from "../lib/ai/refinement/context-builder.js";
import { loadDocumentPages } from "../lib/ai/refinement/document-text.js";
import { runRefinementAnalysis } from "../lib/ai/refinement/analysis-runner.js";
import {
  getRefinementAnalysis,
  persistRefinementAnalysis,
  refinementFingerprint,
  startRefinementAnalysis,
} from "../lib/ai/refinement/run-service.js";

const SMI = "bu-smi";
const procurement = { id: "user-cg", role: "CORPORATE_GOVERNANCE", businessUnitId: null, businessUnitScopes: [] };
const smiPic = { id: "user-smi", role: "BUSINESS_UNIT_PIC", businessUnitId: SMI, businessUnitScopes: [] };
const otherPic = { id: "user-x", role: "BUSINESS_UNIT_PIC", businessUnitId: "bu-other", businessUnitScopes: [] };

const version = {
  id: "ver-1", versionNo: "v1.0", fileKey: "gdrive:sop-1", fileName: "SOP.pdf", contentType: "application/pdf",
  sopDocument: { id: "sop-1", title: "SOP Pengadaan", businessUnitId: SMI },
};

// Honour `select` the way Prisma does, so "this field is not returned" is a
// real assertion about the query rather than an artefact of the stub.
function project(record, select) {
  if (!record || !select) return record;
  const out = {};
  for (const [key, value] of Object.entries(select)) {
    if (!value) continue;
    if (value === true) { if (key in record) out[key] = record[key]; continue; }
    const nested = record[key];
    if (Array.isArray(nested)) out[key] = nested.map((entry) => project(entry, value.select || value));
    else if (nested && typeof nested === "object") out[key] = project(nested, value.select || value);
    else if (key in record) out[key] = nested;
  }
  return out;
}

function fakeDb({ jobs = [], sources, findUniqueVersion = version } = {}) {
  const state = {
    jobs: [...jobs],
    findings: [],
    referenceSources: sources ?? [
      { id: "src-1", title: "POJK 12/2026", type: "REGULATION", fileKey: "gdrive:src-1", contentHash: "hash-1", isApproved: true },
    ],
  };
  const db = {
    state,
    sopVersion: { findUnique: async () => findUniqueVersion },
    referenceSource: {
      findMany: async ({ where }) => state.referenceSources.filter((source) =>
        (!where?.id?.in || where.id.in.includes(source.id)) && (where?.isApproved === undefined || source.isApproved === where.isApproved)),
    },
    refinementJob: {
      findFirst: async ({ where }) => state.jobs.find((job) => job.fingerprint === where.fingerprint
        && (where.status?.in ? where.status.in.includes(job.status) : job.status === where.status)) || null,
      findUnique: async ({ where, select }) => { const job = state.jobs.find((entry) => entry.id === where.id); return job ? project(job, select) : null; },
      findMany: async () => state.jobs,
      create: async ({ data }) => { const job = { id: `job-${state.jobs.length + 1}`, ...data }; state.jobs.push(job); return job; },
      update: async ({ where, data }) => { const job = state.jobs.find((entry) => entry.id === where.id); Object.assign(job, data); return job; },
    },
    refinementFinding: {
      deleteMany: async ({ where }) => { state.findings = state.findings.filter((f) => f.refinementJobId !== where.refinementJobId); },
      createMany: async ({ data }) => { state.findings.push(...data); return { count: data.length }; },
    },
    $transaction: async (fn) => fn(db),
  };
  return db;
}

const pdfPages = (count, prefix) => ({
  fileName: `${prefix}.pdf`, pageCount: count, characterCount: count * 100,
  pages: Array.from({ length: count }, (_, index) => ({ pageNumber: index + 1, text: `${prefix} halaman ${index + 1}`, characterCount: 100 })),
});

// --- Fingerprint and reuse --------------------------------------------------

test("the fingerprint is stable regardless of source order", () => {
  const a = refinementFingerprint({ sopVersionId: "v", sopFileKey: "k", sources: [{ id: "s1", contentHash: "h1" }, { id: "s2", contentHash: "h2" }], model: "m" });
  const b = refinementFingerprint({ sopVersionId: "v", sopFileKey: "k", sources: [{ id: "s2", contentHash: "h2" }, { id: "s1", contentHash: "h1" }], model: "m" });
  assert.equal(a, b);
});

test("the fingerprint changes when the source content changes", () => {
  const before = refinementFingerprint({ sopVersionId: "v", sopFileKey: "k", sources: [{ id: "s1", contentHash: "h1" }], model: "m" });
  const after = refinementFingerprint({ sopVersionId: "v", sopFileKey: "k", sources: [{ id: "s1", contentHash: "h2" }], model: "m" });
  assert.notEqual(before, after);
});

test("an identical completed analysis is reused instead of re-run", async () => {
  const fingerprint = refinementFingerprint({ sopVersionId: version.id, sopFileKey: version.fileKey, sources: [{ id: "src-1", contentHash: "hash-1" }], model: null });
  const db = fakeDb({ jobs: [{ id: "job-old", fingerprint, status: "COMPLETED", completedAt: new Date() }] });
  let enqueued = 0;

  const result = await startRefinementAnalysis(procurement, version.id, { sourceIds: ["src-1"], db, environment: {}, enqueue: async () => { enqueued += 1; } });
  assert.equal(result.reused, true);
  assert.equal(result.queued, false);
  assert.equal(result.job.id, "job-old");
  assert.equal(enqueued, 0);
});

test("an identical in-flight analysis is joined rather than duplicated", async () => {
  const fingerprint = refinementFingerprint({ sopVersionId: version.id, sopFileKey: version.fileKey, sources: [{ id: "src-1", contentHash: "hash-1" }], model: null });
  const db = fakeDb({ jobs: [{ id: "job-running", fingerprint, status: "ANALYZING" }] });
  const result = await startRefinementAnalysis(procurement, version.id, { sourceIds: ["src-1"], db, environment: {}, enqueue: async () => {} });

  assert.equal(result.job.id, "job-running");
  assert.equal(result.queued, false);
  assert.equal(db.state.jobs.length, 1);
});

test("a new analysis is created and enqueued once", async () => {
  const db = fakeDb();
  const enqueued = [];
  const result = await startRefinementAnalysis(procurement, version.id, { sourceIds: ["src-1"], db, environment: {}, enqueue: async (id) => enqueued.push(id) });

  assert.equal(result.queued, true);
  assert.equal(db.state.jobs[0].status, "QUEUED");
  assert.equal(db.state.jobs[0].businessUnitId, SMI);
  assert.equal(db.state.jobs[0].promptVersion, "refinement.v1");
  assert.deepEqual(db.state.jobs[0].configurationJson.sourceIds, ["src-1"]);
  assert.deepEqual(enqueued, [result.job.id]);
});

// --- Source validation and authorization -----------------------------------

test("an unknown source is rejected", async () => {
  await assert.rejects(
    startRefinementAnalysis(procurement, version.id, { sourceIds: ["src-missing"], db: fakeDb(), environment: {} }),
    { code: "NOT_FOUND" },
  );
});

test("an unapproved source cannot back an analysis", async () => {
  const db = fakeDb({ sources: [{ id: "src-draft", title: "Draft regulasi", fileKey: "gdrive:d", contentHash: "h", isApproved: false }] });
  await assert.rejects(
    startRefinementAnalysis(procurement, version.id, { sourceIds: ["src-draft"], db, environment: {} }),
    { code: "INVALID_INPUT" },
  );
});

test("an empty source list is rejected", async () => {
  await assert.rejects(startRefinementAnalysis(procurement, version.id, { sourceIds: [], db: fakeDb(), environment: {} }), { code: "INVALID_INPUT" });
});

test("a Business Unit user cannot start an analysis", async () => {
  await assert.rejects(
    startRefinementAnalysis(smiPic, version.id, { sourceIds: ["src-1"], db: fakeDb(), environment: {} }),
    { code: "FORBIDDEN" },
  );
});

test("the refinement flag stops an analysis before any database write", async () => {
  const db = fakeDb();
  await assert.rejects(
    startRefinementAnalysis(procurement, version.id, { sourceIds: ["src-1"], db, environment: { AI_REFINEMENT_ENABLED: "false" } }),
    { code: "AI_DISABLED" },
  );
  assert.equal(db.state.jobs.length, 0);
});

test("reading an analysis outside the caller's scope is refused", async () => {
  const db = fakeDb({ jobs: [{ id: "job-1", status: "COMPLETED", businessUnitId: SMI, findings: [], sopVersion: { versionNo: "v1.0", sopDocument: { id: "sop-1", title: "SOP" } } }] });
  await assert.rejects(getRefinementAnalysis(otherPic, "job-1", { db }), { code: "OUT_OF_SCOPE" });
});

test("the stored provider error message is never returned by the read API", async () => {
  const db = fakeDb({ jobs: [{ id: "job-1", status: "FAILED", businessUnitId: SMI, errorType: "AI_TIMEOUT", errorMessage: "anthropic detail leak", findings: [], sopVersion: { versionNo: "v1.0", sopDocument: { id: "sop-1", title: "SOP" } } }] });
  const job = await getRefinementAnalysis(procurement, "job-1", { db });
  assert.equal(job.errorType, "AI_TIMEOUT");
  assert.equal("errorMessage" in job, false);
});

// --- Persistence ------------------------------------------------------------

test("candidate findings are persisted against the job and version", async () => {
  const db = fakeDb({ jobs: [{ id: "job-1", status: "ANALYZING", configurationJson: { methodVersion: "lexical-retrieval.v1", sourceIds: ["src-1"] } }] });
  await persistRefinementAnalysis({
    db, jobId: "job-1", sopVersionId: "ver-1", summary: "ringkasan", model: "claude-opus-5",
    findings: [{ title: "Matriks otorisasi belum lengkap", category: "CONTROL_WEAKNESS", severity: "HIGH", gap: "SOP tidak mengatur batas nilai", recommendation: "Tambahkan matriks", confidence: 0.8, evidence: { sopSection: "Pasal 5", sourceSection: "Pasal 12", sourceQuote: "..." } }],
  });

  assert.equal(db.state.findings.length, 1);
  assert.equal(db.state.findings[0].refinementJobId, "job-1");
  assert.equal(db.state.findings[0].sopVersionId, "ver-1");
  assert.equal(db.state.findings[0].severity, "HIGH");
  assert.equal(db.state.findings[0].evidenceJson.sopSection, "Pasal 5");
  assert.equal(db.state.jobs[0].status, "COMPLETED");
  // Original configuration is merged, not replaced.
  assert.equal(db.state.jobs[0].configurationJson.methodVersion, "lexical-retrieval.v1");
  assert.equal(db.state.jobs[0].configurationJson.summary, "ringkasan");
});

test("an out-of-enum category or severity is normalised rather than rejected", async () => {
  const db = fakeDb({ jobs: [{ id: "job-1", status: "ANALYZING", configurationJson: {} }] });
  await persistRefinementAnalysis({ db, jobId: "job-1", sopVersionId: "ver-1", summary: "s", findings: [{ title: "t", category: "SOMETHING_ELSE", severity: "EXTREME", gap: "g", recommendation: "r", confidence: 9 }] });

  assert.equal(db.state.findings[0].category, "OTHER");
  assert.equal(db.state.findings[0].severity, "MEDIUM");
  assert.equal(db.state.findings[0].confidence, null);
});

// --- Runner -----------------------------------------------------------------

test("a run advances status, calls the provider per source, and completes", async () => {
  const db = fakeDb({ jobs: [{ id: "job-1", status: "QUEUED", businessUnitId: SMI, model: null, configurationJson: { sourceIds: ["src-1"] }, sopVersion: version }] });
  const calls = [];
  const aiService = { async analyzeRefinement(request) { calls.push(request); return { summary: "ringkasan", findings: [{ title: "t", category: "PROCESS_GAP", severity: "LOW", gap: "g", recommendation: "r", confidence: 0.5, evidence: {} }], model: "claude-opus-5" }; } };

  await runRefinementAnalysis("job-1", { db, aiService, environment: {}, loadPages: async ({ fileName }) => pdfPages(2, fileName) });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sopContext, /\[hal\. 1\]/);
  assert.match(calls[0].scopeNote, /halaman disertakan/);
  assert.equal(db.state.jobs[0].status, "COMPLETED");
  assert.equal(db.state.findings.length, 1);
  // Every finding is traceable back to the source it came from.
  assert.equal(db.state.findings[0].evidenceJson.sourceId, "src-1");
});

test("a provider failure marks the job FAILED with a classified error type", async () => {
  const db = fakeDb({ jobs: [{ id: "job-1", status: "QUEUED", businessUnitId: SMI, configurationJson: { sourceIds: ["src-1"] }, sopVersion: version }] });
  const aiService = { async analyzeRefinement() { const error = new Error("upstream detail"); error.name = "AiServiceError"; error.code = "AI_RATE_LIMITED"; throw error; } };

  await assert.rejects(runRefinementAnalysis("job-1", { db, aiService, environment: {}, loadPages: async ({ fileName }) => pdfPages(1, fileName) }));
  assert.equal(db.state.jobs[0].status, "FAILED");
  assert.equal(db.state.jobs[0].errorType, "AI_PROVIDER_UNAVAILABLE");
  assert.equal(db.state.findings.length, 0);
});

test("a job that is no longer queued is not run twice", async () => {
  const db = fakeDb({ jobs: [{ id: "job-1", status: "COMPLETED", configurationJson: {}, sopVersion: version }] });
  let called = false;
  const result = await runRefinementAnalysis("job-1", { db, aiService: { async analyzeRefinement() { called = true; } }, environment: {}, loadPages: async () => pdfPages(1, "x") });

  assert.equal(result.skipped, true);
  assert.equal(called, false);
});

// --- Retrieval and document scope ------------------------------------------

test("source pages are selected by overlap with the SOP rather than by position", () => {
  const sopDocument = { fileName: "SOP.pdf", pageCount: 1, pages: [{ pageNumber: 1, text: "kewajiban vendor melakukan evaluasi pemasok berkala", characterCount: 60 }] };
  const sourceDocument = {
    fileName: "Regulasi.pdf", pageCount: 3,
    pages: [
      { pageNumber: 1, text: "ketentuan umum mengenai permodalan bank", characterCount: 50 },
      { pageNumber: 2, text: "ketentuan lain mengenai pelaporan tahunan", characterCount: 50 },
      { pageNumber: 3, text: "evaluasi pemasok wajib dilakukan berkala oleh vendor", characterCount: 60 },
    ],
  };
  // A budget that admits the SOP page plus roughly one source page.
  const built = buildRefinementContext({ sopDocument, sourceDocument, maxContextTokens: 60 });

  assert.deepEqual(built.sourcePagesIncluded, [3]);
  assert.match(built.sourceContext, /evaluasi pemasok/);
  assert.equal(built.complete, false);
});

test("omitted pages are declared so absence is not read as evidence", () => {
  const built = buildRefinementContext({
    sopDocument: { fileName: "SOP.pdf", pageCount: 40, pages: Array.from({ length: 40 }, (_, i) => ({ pageNumber: i + 1, text: "isi sop ".repeat(60), characterCount: 400 })) },
    sourceDocument: { fileName: "Regulasi.pdf", pageCount: 40, pages: Array.from({ length: 40 }, (_, i) => ({ pageNumber: i + 1, text: "isi regulasi ".repeat(60), characterCount: 400 })) },
    maxContextTokens: 2_000,
  });

  assert.ok(built.omittedPageCount > 0);
  assert.match(built.scopeNote, /tidak disertakan karena batas ukuran konteks/);
  assert.match(built.scopeNote, /Jangan menyimpulkan bahwa isinya tidak ada/);
});

test("a DOCX document is rejected with a clear reason", async () => {
  await assert.rejects(
    loadDocumentPages({ fileKey: "gdrive:x", fileName: "SOP.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
    (error) => error.code === "AI_INVALID_INPUT" && /PDF/.test(error.message),
  );
});

test("a scanned PDF with no text layer is rejected rather than analysed as empty", async () => {
  await assert.rejects(
    loadDocumentPages({
      fileKey: "gdrive:scan", fileName: "Scan.pdf", contentType: "application/pdf",
      readObject: async () => ({ Body: Buffer.from("%PDF-1.7") }),
      extract: async () => ({ pageCount: 3, pages: [], text: "", characterCount: 0, isSearchable: false }),
    }),
    (error) => error.code === "AI_INVALID_INPUT" && /text layer/.test(error.message),
  );
});

test("a document with no stored file is rejected", async () => {
  await assert.rejects(loadDocumentPages({ fileKey: null, fileName: "SOP.pdf" }), { code: "AI_INVALID_INPUT" });
});
