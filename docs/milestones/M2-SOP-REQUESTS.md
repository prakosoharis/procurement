# M2 — SOP Request & Intake

Status: IN_PROGRESS. The legacy request model (`SopRequest`, discussion messages, notifications, and request statuses) remains the source of business evidence. Native migration begins with reconciliation before any request state behavior changes.

Completed native checkpoints: list, intake, detail/review, and chronological
discussion history.

## Remaining delivery path

- **M2-C6 — Convert Approved Submission to SOP Draft or Revision** is in
  progress. Its reconciliation recommendations are accepted: new native
  Submissions use `conversionIntent`/`requestedBusinessUnitId`, and an
  append-only `SubmissionConversion` model enforces one conversion per
  Submission. M2-C6-T2 has added the migration and transactional service;
  M2-C6-T3 can now expose it through the named governance API.
- **M2-C7 — M2 Final Acceptance** is `PLANNED` and now owns final milestone
  acceptance. It does not alter the completed M2-C1 through M2-C5 history.

M2 remains in progress until M2-C6 is complete, M2-C7 evidence is recorded, and
the user explicitly accepts the milestone.
