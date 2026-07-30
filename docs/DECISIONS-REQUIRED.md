# Decisions required

| ID | Milestone | Question | Status |
|---|---|---|---|
| DR-M3-01 | M3 | What is the final Refinement workspace, evidence, disposition, and reference-set UX? | DECISION_REQUIRED |
| DR-M5-01 | M5 | What is the final iMemo integration/evidence contract? | DECISION_REQUIRED |
| DR-M6-01 | M6 | What is the final ClickUp integration/reference contract? | DECISION_REQUIRED |
| DR-M2-01 | M2-C6 | Should a new-SOP Submission be selectable at intake with no existing `sopDocumentId`, and which metadata must be mandatory before conversion? Current native intake requires an SOP ID, so it cannot safely express this branch. | DECISION_REQUIRED |
| DR-M2-02 | M2-C6 | Approve the durable idempotency design: a one-to-one append-only `SubmissionConversion` record (recommended) versus explicitly named conversion fields on `SopRequest`. The existing schema has no generated-version link or uniqueness authority. | DECISION_REQUIRED |
