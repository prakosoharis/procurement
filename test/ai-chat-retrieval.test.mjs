import assert from "node:assert/strict";
import test from "node:test";
import { buildChatContext, estimateTokens } from "../lib/ai/chat/context-builder.js";
import { classifyChatScope, OUT_OF_SCOPE_ANSWER } from "../lib/ai/chat/scope-classifier.js";
import { retrieveForTopics } from "../lib/ai/chat/retrievers/index.js";

// --- A fake Prisma that actually applies the where clause -------------------
// The point of these tests is to prove scoping, so the stub filters rather than
// returning everything. It supports the clause shapes the retrievers build.

function matches(record, where) {
  if (!where || typeof where !== "object") return true;
  for (const [key, condition] of Object.entries(where)) {
    if (key === "OR") {
      if (!condition.some((branch) => matches(record, branch))) return false;
      continue;
    }
    if (key === "some") {
      if (!Array.isArray(record) || !record.some((entry) => matches(entry, condition))) return false;
      continue;
    }
    const value = record?.[key];
    if (condition && typeof condition === "object" && !Array.isArray(condition) && !(condition instanceof Date)) {
      if ("in" in condition) {
        const allowed = Array.isArray(condition.in) ? condition.in : [condition.in];
        if (!allowed.includes(value)) return false;
        continue;
      }
      if ("some" in condition) {
        if (!Array.isArray(value) || !value.some((entry) => matches(entry, condition.some))) return false;
        continue;
      }
      if (!matches(value, condition)) return false;
      continue;
    }
    if (value !== condition) return false;
  }
  return true;
}

const SMI = "bu-smi";
const SUN = "bu-sun";

const fixtures = {
  businessUnit: [
    { id: SMI, name: "SMI", groupName: "SSM", industry: "Infrastruktur" },
    { id: SUN, name: "SUN", groupName: "SSM", industry: "Energi" },
  ],
  documentType: [
    { id: "dt-1", code: "M1", name: "Procurement Policy", category: "MANDATORY", sortOrder: 1 },
    { id: "dt-6", code: "M6", name: "Value Creation", category: "MANDATORY", sortOrder: 6 },
  ],
  sopDocument: [
    { id: "sop-smi", title: "SOP Pengadaan SMI", status: "APPROVED", currentVersion: "v1.0", updatedAt: new Date("2026-08-01"), businessUnit: { id: SMI, name: "SMI" }, documentType: { code: "M1", name: "Procurement Policy", category: "MANDATORY" }, versions: [{ versionNo: "v1.0", approvalStatus: "APPROVED", uploadedAt: new Date("2026-08-01"), reviewer: { name: "Reviewer A" } }] },
    { id: "sop-sun", title: "SOP RAHASIA SUN", status: "APPROVED", currentVersion: "v2.0", updatedAt: new Date("2026-08-02"), businessUnit: { id: SUN, name: "SUN" }, documentType: { code: "M1", name: "Procurement Policy", category: "MANDATORY" }, versions: [{ versionNo: "v2.0", approvalStatus: "APPROVED", uploadedAt: new Date("2026-08-02"), reviewer: { name: "Reviewer B" } }] },
  ],
  sopRequest: [
    { id: "req-smi", title: "Usulan revisi SMI", status: "SUBMITTED", priority: "HIGH", createdAt: new Date("2026-08-03"), reviewedAt: null, requester: { name: "Budi", businessUnitId: SMI, businessUnit: { name: "SMI" } }, sopDocument: { title: "SOP Pengadaan SMI" } },
    { id: "req-sun", title: "Usulan RAHASIA SUN", status: "SUBMITTED", priority: "LOW", createdAt: new Date("2026-08-04"), reviewedAt: null, requester: { name: "Citra", businessUnitId: SUN, businessUnit: { name: "SUN" } }, sopDocument: { title: "SOP RAHASIA SUN" } },
  ],
  refinementSession: [
    { id: "rs-smi", businessUnitId: SMI, status: "IN_PROGRESS", cycleNo: 1, mode: "HUMAN_ONLY", summary: null, startedAt: new Date("2026-08-05"), completedAt: null, businessUnit: { name: "SMI" }, sopVersion: { versionNo: "v1.0", sopDocument: { id: "sop-smi", title: "SOP Pengadaan SMI" } }, humanFindings: [{ id: "f-smi", title: "Kontrol approval belum lengkap", category: "CONTROL_WEAKNESS", severity: "HIGH", status: "OPEN", blocking: true, recommendation: "Tambahkan matriks otorisasi" }] },
    { id: "rs-sun", businessUnitId: SUN, status: "IN_PROGRESS", cycleNo: 1, mode: "HUMAN_ONLY", summary: null, startedAt: new Date("2026-08-06"), completedAt: null, businessUnit: { name: "SUN" }, sopVersion: { versionNo: "v2.0", sopDocument: { id: "sop-sun", title: "SOP RAHASIA SUN" } }, humanFindings: [{ id: "f-sun", title: "Temuan RAHASIA SUN", category: "PROCESS_GAP", severity: "CRITICAL", status: "OPEN", blocking: true, recommendation: "Rahasia" }] },
  ],
  auditEvent: [
    { id: "ae-open", title: "Workshop procurement", agenda: "Sosialisasi", format: "REMOTE", audience: "ALL_BUSINESS_UNITS", location: null, startAt: new Date("2026-09-01"), endAt: null, status: "SCHEDULED", businessUnit: null, participants: [{ responseStatus: "INVITED", userId: "user-other" }] },
    { id: "ae-private", title: "Audit RAHASIA SUN", agenda: "Rahasia", format: "ONSITE", audience: "SELECTED_PICS", location: "Jakarta", startAt: new Date("2026-09-02"), endAt: null, status: "SCHEDULED", businessUnit: { name: "SUN" }, participants: [{ responseStatus: "INVITED", userId: "user-sun" }] },
  ],
  organizationPosition: [
    { id: "pos-smi", title: "Procurement Manager SMI", code: "SMI-PM", displayOrder: 1, status: "ACTIVE", businessUnitId: SMI, organizationGroupId: null, businessUnit: { name: "SMI" }, organizationGroup: null, parent: null, assignments: [{ type: "PERMANENT", startDate: new Date("2024-01-01"), person: { fullName: "Dewi", status: "ACTIVE" } }] },
    { id: "pos-sun", title: "Procurement Manager SUN", code: "SUN-PM", displayOrder: 1, status: "ACTIVE", businessUnitId: SUN, organizationGroupId: null, businessUnit: { name: "SUN" }, organizationGroup: null, parent: null, assignments: [{ type: "PERMANENT", startDate: new Date("2024-01-01"), person: { fullName: "Eko RAHASIA", status: "ACTIVE" } }] },
  ],
};

function fakeDb() {
  const model = (name) => ({ findMany: async ({ where } = {}) => fixtures[name].filter((record) => matches(record, where)) });
  return {
    businessUnit: model("businessUnit"),
    documentType: model("documentType"),
    sopDocument: model("sopDocument"),
    sopRequest: model("sopRequest"),
    refinementSession: model("refinementSession"),
    auditEvent: model("auditEvent"),
    organizationPosition: model("organizationPosition"),
  };
}

const smiPic = { id: "user-smi", role: "BUSINESS_UNIT_PIC", businessUnitId: SMI, businessUnitScopes: [] };
const scopelessPic = { id: "user-none", role: "BUSINESS_UNIT_PIC", businessUnitId: null, businessUnitScopes: [] };
const procurement = { id: "user-cg", role: "CORPORATE_GOVERNANCE", businessUnitId: null, businessUnitScopes: [] };

const allTopics = ["repository", "submissions", "refinement", "audit", "people"];

async function contextFor(actor) {
  const results = await retrieveForTopics({ actor, db: fakeDb(), topics: allTopics });
  return buildChatContext({ results, maxContextTokens: 60_000 });
}

// --- Scope classification ---------------------------------------------------

test("a governance question is in scope and selects its topics", () => {
  assert.deepEqual(classifyChatScope("SOP mana yang menunggu review?"), { inScope: true, topics: ["repository"], reason: null });
  assert.equal(classifyChatScope("Jadwal audit bulan depan apa saja?").topics.includes("audit"), true);
  assert.equal(classifyChatScope("Posisi mana yang masih lowong?").topics.includes("people"), true);
});

test("an out-of-scope question is rejected before any retrieval", () => {
  for (const question of ["Siapa juara Piala Dunia berikutnya?", "Buatkan saya game Python", "Harga bitcoin besok berapa?", "Bagaimana cuaca hari ini?"]) {
    const classification = classifyChatScope(question);
    assert.equal(classification.inScope, false, question);
    assert.equal(classification.topics.length, 0);
  }
  assert.match(OUT_OF_SCOPE_ANSWER, /Procurement Governance Hub/);
});

test("an empty question is rejected without a topic", () => {
  assert.deepEqual(classifyChatScope("   "), { inScope: false, topics: [], reason: "EMPTY_QUESTION" });
});

// --- Permission-aware retrieval ---------------------------------------------

test("a Business Unit user's context contains no other Business Unit's data", async () => {
  const built = await contextFor(smiPic);
  assert.ok(built.recordCount > 0);
  assert.doesNotMatch(built.context, /SUN/);
  assert.doesNotMatch(built.context, /RAHASIA/);
  assert.match(built.context, /SOP Pengadaan SMI/);
});

test("Tim Procurement retrieval spans every Business Unit", async () => {
  const built = await contextFor(procurement);
  assert.match(built.context, /SOP Pengadaan SMI/);
  assert.match(built.context, /SOP RAHASIA SUN/);
});

test("a Business Unit user with no effective scope fails closed", async () => {
  const built = await contextFor(scopelessPic);
  assert.doesNotMatch(built.context, /SOP Pengadaan SMI/);
  assert.doesNotMatch(built.context, /SUN/);
  assert.doesNotMatch(built.context, /Dewi/);
});

test("audit appointments stay private to invited PICs", async () => {
  const results = await retrieveForTopics({ actor: smiPic, db: fakeDb(), topics: ["audit"] });
  const labels = results[0].records.map((record) => record.label);
  assert.deepEqual(labels, ["Workshop procurement"]);
});

test("repository coverage is derived only from documents in scope", async () => {
  const results = await retrieveForTopics({ actor: smiPic, db: fakeDb(), topics: ["repository"] });
  const coverage = results[0].records.filter((record) => record.type === "REPOSITORY_COVERAGE");
  assert.deepEqual(coverage.map((record) => record.label), ["SMI"]);
  assert.deepEqual(coverage[0].approvedMandatoryTypes, ["M1"]);
  assert.ok(coverage[0].missingMandatoryTypes.some((entry) => entry.startsWith("M6")));
});

test("chat context never carries personal contact data", async () => {
  const results = await retrieveForTopics({ actor: procurement, db: fakeDb(), topics: ["people"] });
  const serialized = JSON.stringify(results);
  assert.doesNotMatch(serialized, /email|phone|credentialId|evidenceUrl/i);
  assert.match(serialized, /Dewi/);
});

test("a failing retriever degrades to an empty topic instead of failing the request", async () => {
  const db = fakeDb();
  db.sopDocument = { findMany: async () => { throw new Error("database unavailable"); } };
  const results = await retrieveForTopics({ actor: procurement, db, topics: ["repository", "submissions"] });
  const repository = results.find((result) => result.topic === "repository");
  assert.equal(repository.failed, true);
  assert.equal(repository.records.length, 0);
  assert.ok(results.find((result) => result.topic === "submissions").records.length > 0);
});

// --- Context assembly -------------------------------------------------------

test("an actor with no matching data produces an empty context for the honest-answer path", async () => {
  const db = fakeDb();
  for (const name of Object.keys(db)) db[name] = { findMany: async () => [] };
  const built = buildChatContext({ results: await retrieveForTopics({ actor: procurement, db, topics: allTopics }) });
  assert.equal(built.recordCount, 0);
  assert.equal(built.context, "");
});

test("context truncation is stated rather than applied silently", async () => {
  const results = await retrieveForTopics({ actor: procurement, db: fakeDb(), topics: allTopics });
  const built = buildChatContext({ results, maxContextTokens: 120 });
  assert.ok(built.droppedCount > 0);
  assert.match(built.context, /tidak dimuat karena batas ukuran konteks/);
  assert.ok(built.estimatedTokens < estimateTokens(JSON.stringify(results)));
});

test("a failed topic is disclosed in the context", async () => {
  const db = fakeDb();
  db.sopDocument = { findMany: async () => { throw new Error("database unavailable"); } };
  const built = buildChatContext({ results: await retrieveForTopics({ actor: procurement, db, topics: ["repository"] }) });
  assert.deepEqual(built.failedTopics, ["repository"]);
  assert.match(built.context, /gagal dimuat/);
});
