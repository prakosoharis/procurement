# Decisions required

| ID | Milestone | Question | Status |
|---|---|---|---|
| DR-M3-01 | M3-C0 | Final Refinement workspace, evidence, disposition, and reference-set UX. | ACCEPTED 2026-07-30 |
| DR-M3-C1-01 | M3-C1 | Separate additive `RefinementSession` with per-version iteration rather than repurposing `RefinementJob`. | ACCEPTED 2026-07-31 |
| DR-M3-C1-02 | M3-C1 | Separate Human workspace finding, Evidence, Clarification, and historical session-reference models while preserving existing `Finding` and `RefinementFinding`. | ACCEPTED 2026-07-31 |
| DR-M3-C1-03 | M3-C1 | Keep ActionItem follow-up as draft metadata for M3; PDF supports safe inline preview/download and Office documents download only. | ACCEPTED 2026-07-31 |
| DR-M3-C1-04 | M3-C1 | Native `/api/governance/refinement/*` service/DTO command boundary. | ACCEPTED 2026-07-31 |
| DR-M5-01 | M5 | What is the final iMemo integration/evidence contract? | DECISION_REQUIRED |
| DR-M6-01 | M6 | What is the final ClickUp integration/reference contract? | DECISION_REQUIRED |
| DR-M2-01 | M2-C6 | Approved: add `conversionIntent` and `requestedBusinessUnitId` for native new-SOP Submissions; `EXCEPTION` is not convertible. | ACCEPTED 2026-07-30 |
| DR-M2-02 | M2-C6 | Approved: add append-only `SubmissionConversion` with database-enforced `requestId @unique` idempotency. | ACCEPTED 2026-07-30 |
