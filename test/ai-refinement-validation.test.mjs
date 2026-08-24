import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { decideRefinementFinding } from "../lib/governance/validation/finding-decision-service.js";

const ROUTE = "../app/api/governance/refinement/ai-findings/[findingId]/decision/route.js";
const SMI = "bu-smi";
const procurement = { id: "user-cg", role: "CORPORATE_GOVERNANCE", businessUnitId: null, businessUnitScopes: [] };
const smiPic = { id: "user-smi", role: "BUSINESS_UNIT_PIC", businessUnitId: SMI, businessUnitScopes: [] };

function fakeDb() {
  const state = {
    finding: { id: "rf-1", sopVersionId: "ver-1", humanStatus: "PENDING", sopVersion: { id: "ver-1", lifecycleState: "VALIDATION", sopDocument: { businessUnitId: SMI } } },
    decisions: [],
    audit: [],
  };
  const db = {
    state,
    refinementFinding: {
      findUnique: async () => state.finding,
      update: async ({ data }) => { Object.assign(state.finding, data); return state.finding; },
    },
    validationDecision: { create: async ({ data }) => { state.decisions.push(data); return data; } },
    auditLog: { create: async ({ data }) => { state.audit.push(data); return data; } },
    $transaction: async (fn) => fn(db),
  };
  return db;
}

test("the decision route reuses the existing service instead of duplicating it", async () => {
  const source = await readFile(new URL(ROUTE, import.meta.url), "utf8");
  assert.match(source, /import \{ decideRefinementFinding \}/);
  // No second implementation: the route must not write these tables itself.
  assert.doesNotMatch(source, /validationDecision\.create|refinementFinding\.update|\$transaction/);
});

test("the product decision vocabulary maps onto the existing enum", async () => {
  const source = await readFile(new URL(ROUTE, import.meta.url), "utf8");
  assert.match(source, /VALID: 'ACCEPTED'/);
  assert.match(source, /REVISI: 'ACCEPTED_WITH_MODIFICATION'/);
  assert.match(source, /ABAIKAN: 'REJECTED'/);
});

test("accepting a candidate finding records the decision and the audit trail", async () => {
  const db = fakeDb();
  const updated = await decideRefinementFinding({ findingId: "rf-1", decision: "ACCEPTED", actor: procurement, db });

  assert.equal(updated.humanStatus, "ACCEPTED");
  assert.equal(db.state.decisions.length, 1);
  assert.equal(db.state.decisions[0].reviewerId, procurement.id);
  assert.equal(db.state.decisions[0].refinementFindingId, "rf-1");
  assert.equal(db.state.audit.length, 1);
});

test("a rejection requires a reviewer comment", async () => {
  await assert.rejects(
    decideRefinementFinding({ findingId: "rf-1", decision: "REJECTED", actor: procurement, db: fakeDb() }),
    { code: "MISSING_REQUIRED_METADATA" },
  );
});

test("a revision decision requires the modified recommendation", async () => {
  await assert.rejects(
    decideRefinementFinding({ findingId: "rf-1", decision: "ACCEPTED_WITH_MODIFICATION", comment: "perlu penyesuaian", actor: procurement, db: fakeDb() }),
    { code: "MISSING_REQUIRED_METADATA" },
  );
});

test("a Business Unit user cannot decide an AI candidate finding", async () => {
  await assert.rejects(
    decideRefinementFinding({ findingId: "rf-1", decision: "ACCEPTED", actor: smiPic, db: fakeDb() }),
    { code: "FORBIDDEN" },
  );
});

test("an unknown decision value is refused", async () => {
  await assert.rejects(
    decideRefinementFinding({ findingId: "rf-1", decision: "AUTO_APPROVE", actor: procurement, db: fakeDb() }),
    { code: "MISSING_REQUIRED_METADATA" },
  );
});

test("no AI path can approve a finding without a human reviewer", async () => {
  const sources = await Promise.all([
    readFile(new URL("../lib/ai/refinement/run-service.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/ai/refinement/analysis-runner.js", import.meta.url), "utf8"),
  ]);
  for (const source of sources) {
    assert.doesNotMatch(source, /humanStatus:\s*['"](?!PENDING)/);
    assert.doesNotMatch(source, /validationDecision|publishingRecord|publishedVersionId/);
  }
});
