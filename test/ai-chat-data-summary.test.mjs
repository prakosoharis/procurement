import assert from "node:assert/strict";
import test from "node:test";
import { answerFromData, DATA_SUMMARY_NOTE } from "../lib/ai/chat/data-summary-responder.js";
import { answerChatQuestion } from "../lib/ai/chat/chat-service.js";

const coverage = (label, missing) => ({ type: "REPOSITORY_COVERAGE", id: label, label, missingMandatoryTypes: missing });
const doc = (label, status, extra = {}) => ({ type: "SOP_DOCUMENT", id: label, label, status, businessUnit: "SMI", currentVersion: "v1.0", ...extra });

const answer = (question, results) => answerFromData({ question, results });

// --- Repository -------------------------------------------------------------

test("a coverage question lists each incomplete Business Unit and what it is missing", () => {
  const result = answer("BU mana yang dokumennya belum lengkap?", [{ topic: "repository", records: [
    coverage("SMI", ["M4 Matrix Level Authorization", "M6 Value Creation"]),
    coverage("SUN", ["M6 Value Creation"]),
    coverage("SSM", []),
  ] }]);

  assert.equal(result.dataAvailable, true);
  assert.match(result.answer, /2 dari 3 Business Unit belum melengkapi/);
  assert.match(result.answer, /SMI — kurang 2: M4 Matrix Level Authorization, M6 Value Creation/);
  assert.match(result.answer, /Sudah lengkap: SSM\./);
});

test("full coverage is reported as complete rather than as an empty list", () => {
  const result = answer("Apakah dokumen wajib sudah lengkap?", [{ topic: "repository", records: [coverage("SMI", []), coverage("SUN", [])] }]);
  assert.match(result.answer, /Seluruh 2 Business Unit sudah melengkapi/);
});

test("a review question lists drafts with their assigned reviewer", () => {
  const result = answer("SOP mana yang menunggu review?", [{ topic: "repository", records: [
    doc("SOP Pengadaan", "DRAFT", { assignedReviewer: "Andi" }),
    doc("SOP Etika", "APPROVED"),
  ] }]);

  assert.match(result.answer, /1 dokumen menunggu review/);
  assert.match(result.answer, /SOP Pengadaan \(SMI\) v1\.0 — reviewer: Andi/);
  assert.doesNotMatch(result.answer, /SOP Etika/);
});

test("a draft with no reviewer is stated rather than left blank", () => {
  const result = answer("SOP mana yang menunggu review?", [{ topic: "repository", records: [doc("SOP Baru", "DRAFT")] }]);
  assert.match(result.answer, /belum ditugaskan/);
});

test("no drafts is answered as none, not as missing data", () => {
  const result = answer("SOP mana yang menunggu review?", [{ topic: "repository", records: [doc("SOP Etika", "APPROVED")] }]);
  assert.equal(result.dataAvailable, true);
  assert.match(result.answer, /Tidak ada dokumen berstatus draft/);
});

// --- People, audit, refinement, submissions --------------------------------

test("a vacancy question lists only vacant positions", () => {
  const result = answer("Posisi mana yang masih lowong?", [{ topic: "people", records: [
    { type: "ORGANIZATION_POSITION", id: "p1", label: "Procurement Manager", scope: "SMI", vacant: true, occupants: [] },
    { type: "ORGANIZATION_POSITION", id: "p2", label: "Staf Pengadaan", scope: "SMI", vacant: false, occupants: [{ name: "Dewi" }] },
  ] }]);

  assert.match(result.answer, /1 posisi lowong/);
  assert.match(result.answer, /Procurement Manager \(SMI\)/);
  assert.doesNotMatch(result.answer, /Staf Pengadaan/);
});

test("an occupancy question names the current occupant", () => {
  const result = answer("Siapa yang menjabat Procurement Manager?", [{ topic: "people", records: [
    { type: "ORGANIZATION_POSITION", id: "p1", label: "Procurement Manager", scope: "SMI", vacant: false, occupants: [{ name: "Dewi" }] },
  ] }]);
  assert.match(result.answer, /Procurement Manager \(SMI\) — Dewi/);
});

test("an audit question lists upcoming appointments only", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const result = answer("Jadwal audit mendatang apa saja?", [{ topic: "audit", records: [
    { type: "AUDIT_EVENT", id: "a1", label: "Audit SMI", startAt: future, format: "ONSITE", status: "SCHEDULED", businessUnit: "SMI", participantCount: 4, confirmedCount: 2 },
    { type: "AUDIT_EVENT", id: "a2", label: "Audit lama", startAt: past, format: "REMOTE", status: "COMPLETED", businessUnit: "SUN", participantCount: 2, confirmedCount: 2 },
  ] }]);

  assert.match(result.answer, /1 jadwal audit mendatang/);
  assert.match(result.answer, /Audit SMI/);
  assert.doesNotMatch(result.answer, /Audit lama/);
  assert.match(result.answer, /2\/4 konfirmasi/);
});

test("a findings question surfaces the highest severity first", () => {
  const result = answer("Apa temuan utama refinement?", [{ topic: "refinement", records: [
    { type: "REFINEMENT_FINDING", id: "f1", label: "Kontrol lemah", severity: "CRITICAL", status: "OPEN", relatedSop: "SOP Pengadaan", businessUnit: "SMI" },
    { type: "REFINEMENT_FINDING", id: "f2", label: "Redaksi ambigu", severity: "LOW", status: "OPEN", relatedSop: "SOP Pengadaan", businessUnit: "SMI" },
  ] }]);

  assert.match(result.answer, /2 temuan tercatat, 2 masih terbuka, 1 di antaranya HIGH atau CRITICAL/);
  assert.match(result.answer, /\[CRITICAL\] Kontrol lemah/);
});

test("a submissions question reports open against total", () => {
  const result = answer("Submission apa yang masih terbuka?", [{ topic: "submissions", records: [
    { type: "SUBMISSION", id: "s1", label: "Usulan revisi", status: "SUBMITTED", priority: "HIGH", businessUnit: "SMI" },
    { type: "SUBMISSION", id: "s2", label: "Usulan lama", status: "APPROVED", priority: "LOW", businessUnit: "SMI" },
  ] }]);

  assert.match(result.answer, /1 submission masih terbuka \(total 2, 1 terbuka\)/);
  assert.doesNotMatch(result.answer, /Usulan lama/);
});

// --- Honesty ----------------------------------------------------------------

test("every answer states that it is not AI analysis", () => {
  const withData = answer("SOP apa saja?", [{ topic: "repository", records: [doc("SOP Etika", "APPROVED")] }]);
  const withoutData = answer("SOP apa saja?", [{ topic: "repository", records: [] }]);

  assert.match(withData.answer, new RegExp(DATA_SUMMARY_NOTE));
  assert.match(withoutData.answer, new RegExp(DATA_SUMMARY_NOTE));
  assert.equal(withData.mode, "DATA_SUMMARY");
  assert.equal(withoutData.mode, "DATA_SUMMARY");
});

test("no matching data is reported honestly and the limit is stated", () => {
  const result = answer("Berapa SOP yang approved?", [{ topic: "repository", records: [] }]);
  assert.equal(result.dataAvailable, false);
  assert.deepEqual(result.references, []);
  assert.match(result.answer, /Tidak ada data yang cocok/);
  assert.match(result.answer, /membutuhkan penalaran atau perbandingan belum dapat dijawab/);
});

test("a long list is capped with the remainder declared rather than truncated silently", () => {
  const records = Array.from({ length: 20 }, (_, index) => coverage(`BU-${index}`, ["M1 Procurement Policy"]));
  const result = answer("BU mana yang belum lengkap?", [{ topic: "repository", records }]);
  assert.match(result.answer, /… dan 8 lainnya\./);
});

// --- Wiring -----------------------------------------------------------------

function stubDb() {
  return {
    aiUsage: { count: async () => 0 },
    aiEvent: { create: async ({ data }) => data },
    sopDocument: { findMany: async ({ where }) => {
      const ids = where?.businessUnit?.id?.in;
      const all = [
        { id: "d1", title: "SOP Pengadaan SMI", status: "DRAFT", currentVersion: "v1.0", updatedAt: new Date(), businessUnit: { id: "bu-smi", name: "SMI" }, documentType: { code: "M1", name: "Policy", category: "MANDATORY" }, versions: [{ approvalStatus: "DRAFT", reviewer: { name: "Andi" } }] },
        { id: "d2", title: "SOP RAHASIA SUN", status: "DRAFT", currentVersion: "v1.0", updatedAt: new Date(), businessUnit: { id: "bu-sun", name: "SUN" }, documentType: { code: "M1", name: "Policy", category: "MANDATORY" }, versions: [{ approvalStatus: "DRAFT", reviewer: { name: "Budi" } }] },
      ];
      return ids ? all.filter((d) => ids.includes(d.businessUnit.id)) : all;
    } },
    businessUnit: { findMany: async ({ where }) => { const ids = where?.id?.in; const all = [{ id: "bu-smi", name: "SMI" }, { id: "bu-sun", name: "SUN" }]; return ids ? all.filter((u) => ids.includes(u.id)) : all; } },
    documentType: { findMany: async () => [{ id: "dt1", code: "M1", name: "Policy" }] },
    sopRequest: { findMany: async () => [] },
    refinementSession: { findMany: async () => [] },
    auditEvent: { findMany: async () => [] },
    organizationPosition: { findMany: async () => [] },
    aiChatConversation: { upsert: async ({ create }) => create },
    aiChatMessage: { create: async ({ data }) => data },
  };
}

const dataSummaryEnv = { AI_CHAT_MODE: "data-summary" };

test("data-summary mode answers without ever calling the provider", async () => {
  let called = false;
  const aiService = { async chat() { called = true; return {}; } };
  const result = await answerChatQuestion({
    actor: { id: "u1", role: "CORPORATE_GOVERNANCE", businessUnitScopes: [] },
    question: "SOP mana yang menunggu review?", db: stubDb(), aiService, environment: dataSummaryEnv,
  });

  assert.equal(called, false);
  assert.equal(result.mode, "DATA_SUMMARY");
  assert.equal(result.inScope, true);
  assert.match(result.answer, /2 dokumen menunggu review/);
});

test("Business Unit scope still applies in data-summary mode", async () => {
  const result = await answerChatQuestion({
    actor: { id: "u2", role: "BUSINESS_UNIT_PIC", businessUnitId: "bu-smi", businessUnitScopes: [] },
    question: "SOP mana yang menunggu review?", db: stubDb(), aiService: { async chat() { throw new Error("must not be called"); } }, environment: dataSummaryEnv,
  });

  assert.match(result.answer, /SOP Pengadaan SMI/);
  assert.doesNotMatch(result.answer, /RAHASIA|SUN/);
});

test("an out-of-scope question is still refused in data-summary mode", async () => {
  const result = await answerChatQuestion({
    actor: { id: "u1", role: "CORPORATE_GOVERNANCE", businessUnitScopes: [] },
    question: "Siapa juara Piala Dunia berikutnya?", db: stubDb(), aiService: { async chat() { throw new Error("must not be called"); } }, environment: dataSummaryEnv,
  });

  assert.equal(result.inScope, false);
  assert.equal(result.mode, "OUT_OF_SCOPE");
});

test("an unknown chat mode falls back to the AI path rather than failing open", async () => {
  const calls = [];
  await answerChatQuestion({
    actor: { id: "u1", role: "CORPORATE_GOVERNANCE", businessUnitScopes: [] },
    question: "SOP mana yang menunggu review?", db: stubDb(),
    aiService: { async chat(request) { calls.push(request); return { answer: "a", dataAvailable: true, references: [] }; } },
    environment: { AI_CHAT_MODE: "sesuatu-yang-salah" },
  });
  assert.equal(calls.length, 1);
});
