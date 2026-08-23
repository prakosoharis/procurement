import assert from "node:assert/strict";
import test from "node:test";
import {
  getRefinementAnalysis,
  importOfflineAnalysis,
  startRefinementAnalysis,
  validateOfflinePayload,
} from "../lib/ai/refinement/run-service.js";

const SMI = "bu-smi";
const procurement = { id: "user-cg", role: "CORPORATE_GOVERNANCE", businessUnitId: null, businessUnitScopes: [] };
const version = {
  id: "ver-1", versionNo: "v1.0", fileKey: "gdrive:sop-1", fileName: "SOP.pdf", contentType: "application/pdf",
  sopDocument: { id: "sop-1", title: "SOP Pengadaan", businessUnitId: SMI },
};

const validFinding = {
  title: "Matriks otorisasi belum lengkap",
  category: "CONTROL_WEAKNESS",
  severity: "HIGH",
  gap: "SOP tidak mengatur batas nilai persetujuan",
  recommendation: "Tambahkan matriks otorisasi berjenjang",
  confidence: 0.8,
  evidence: { sopSection: "Pasal 5", sourceSection: "Pasal 12", sourceQuote: "Batas kewenangan wajib ditetapkan", justification: "Keduanya mengatur kewenangan", impact: "Risiko persetujuan melampaui kewenangan" },
};

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

function fakeDb({ jobs = [] } = {}) {
  const state = {
    jobs: [...jobs],
    findings: [],
    referenceSources: [{ id: "src-1", title: "POJK 12/2026", type: "REGULATION", fileKey: "gdrive:src-1", contentHash: "hash-1", isApproved: true }],
  };
  const db = {
    state,
    sopVersion: { findUnique: async () => version },
    referenceSource: { findMany: async ({ where }) => state.referenceSources.filter((s) => !where?.id?.in || where.id.in.includes(s.id)) },
    refinementJob: {
      findFirst: async () => null,
      findUnique: async ({ where, select }) => { const job = state.jobs.find((j) => j.id === where.id); return job ? project(job, select) : null; },
      findMany: async () => state.jobs,
      create: async ({ data }) => { const job = { id: `job-${state.jobs.length + 1}`, ...data }; state.jobs.push(job); return job; },
      update: async ({ where, data }) => { const job = state.jobs.find((j) => j.id === where.id); Object.assign(job, data); return job; },
    },
    refinementFinding: {
      deleteMany: async ({ where }) => { state.findings = state.findings.filter((f) => f.refinementJobId !== where.refinementJobId); },
      createMany: async ({ data }) => { state.findings.push(...data); return { count: data.length }; },
    },
    $transaction: async (fn) => fn(db),
  };
  return db;
}

// --- Payload validation -----------------------------------------------------

test("a well-formed offline payload validates", () => {
  assert.doesNotThrow(() => validateOfflinePayload({ summary: "ringkasan", findings: [validFinding] }));
  assert.doesNotThrow(() => validateOfflinePayload({ summary: "tidak ada gap", findings: [] }));
});

const malformed = [
  ["a non-object payload", "bukan objek"],
  ["a payload with no summary", { findings: [] }],
  ["a payload with an empty summary", { summary: "  ", findings: [] }],
  ["a payload whose findings are not an array", { summary: "s", findings: "banyak" }],
  ["a finding with no gap", { summary: "s", findings: [{ ...validFinding, gap: "" }] }],
  ["a finding with no recommendation", { summary: "s", findings: [{ ...validFinding, recommendation: "" }] }],
  ["a finding with no evidence", { summary: "s", findings: [{ ...validFinding, evidence: undefined }] }],
  ["a finding with no source quote", { summary: "s", findings: [{ ...validFinding, evidence: { ...validFinding.evidence, sourceQuote: "" } }] }],
];

for (const [description, payload] of malformed) {
  test(`${description} is rejected`, () => {
    assert.throws(() => validateOfflinePayload(payload), { code: "AI_INVALID_OUTPUT" });
  });
}

// --- Import -----------------------------------------------------------------

test("an offline analysis is imported and marked as generated offline", async () => {
  const db = fakeDb({ jobs: [{ id: "job-1", status: "QUEUED", sopVersionId: "ver-1", configurationJson: { methodVersion: "lexical-retrieval.v1", sourceIds: ["src-1"] } }] });
  const result = await importOfflineAnalysis({ db, jobId: "job-1", payload: { summary: "ringkasan", findings: [validFinding] }, generatedAt: new Date("2026-08-23T10:00:00Z") });

  assert.equal(result.status, "COMPLETED");
  assert.equal(db.state.findings.length, 1);
  // Candidate status is untouched: a human still decides.
  assert.equal(db.state.findings[0].humanStatus, undefined);
  const config = db.state.jobs[0].configurationJson;
  assert.equal(config.generatedOffline, true);
  assert.equal(config.generatedWith, "claude-code");
  assert.equal(config.generatedAt, "2026-08-23T10:00:00.000Z");
  // The original method and source set survive the merge.
  assert.deepEqual(config.sourceIds, ["src-1"]);
});

test("an already completed analysis is not overwritten by an import", async () => {
  const db = fakeDb({ jobs: [{ id: "job-1", status: "COMPLETED", sopVersionId: "ver-1", configurationJson: {} }] });
  await assert.rejects(
    importOfflineAnalysis({ db, jobId: "job-1", payload: { summary: "s", findings: [] } }),
    { code: "INVALID_TRANSITION" },
  );
});

test("importing into an unknown analysis is refused", async () => {
  await assert.rejects(importOfflineAnalysis({ db: fakeDb(), jobId: "missing", payload: { summary: "s", findings: [] } }), { code: "NOT_FOUND" });
});

test("a malformed payload is refused before anything is written", async () => {
  const db = fakeDb({ jobs: [{ id: "job-1", status: "QUEUED", sopVersionId: "ver-1", configurationJson: {} }] });
  await assert.rejects(importOfflineAnalysis({ db, jobId: "job-1", payload: { summary: "s" } }), { code: "AI_INVALID_OUTPUT" });
  assert.equal(db.state.jobs[0].status, "QUEUED");
  assert.equal(db.state.findings.length, 0);
});

// --- Provenance visibility --------------------------------------------------

test("the read API declares an offline run so the interface can label it", async () => {
  const db = fakeDb({ jobs: [{ id: "job-1", status: "COMPLETED", businessUnitId: SMI, configurationJson: { generatedOffline: true, generatedWith: "claude-code" }, findings: [], sopVersion: { versionNo: "v1.0", sopDocument: { id: "sop-1", title: "SOP" } } }] });
  const job = await getRefinementAnalysis(procurement, "job-1", { db });
  assert.equal(job.generatedOffline, true);
});

test("a run the application produced itself is not labelled offline", async () => {
  const db = fakeDb({ jobs: [{ id: "job-1", status: "COMPLETED", businessUnitId: SMI, configurationJson: { summary: "s" }, findings: [], sopVersion: { versionNo: "v1.0", sopDocument: { id: "sop-1", title: "SOP" } } }] });
  const job = await getRefinementAnalysis(procurement, "job-1", { db });
  assert.equal(job.generatedOffline, false);
});

// --- Preparation does not call a provider -----------------------------------

test("preparing an offline analysis creates the job without enqueuing a worker", async () => {
  const db = fakeDb();
  // No enqueue callback is supplied, so nothing can reach a provider.
  const result = await startRefinementAnalysis(procurement, version.id, { sourceIds: ["src-1"], db, environment: { AI_REFINEMENT_ENABLED: "true" } });

  assert.equal(result.queued, true);
  assert.equal(db.state.jobs[0].status, "QUEUED");
  assert.equal(db.state.jobs[0].provider, undefined);
});
