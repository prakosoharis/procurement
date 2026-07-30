# M2 — SOP Request & Intake

Status: ACCEPTED. The legacy request model (`SopRequest`, discussion messages, notifications, and request statuses) remains the source of business evidence. Native migration completed without changing its established statuses or removing the legacy evidence path.

Completed native checkpoints: list, intake, detail/review, and chronological
discussion history.

## Remaining delivery path

- **M2-C6 — Convert Approved Submission to SOP Draft or Revision** is in
  progress. Its reconciliation recommendations are accepted: new native
  Submissions use `conversionIntent`/`requestedBusinessUnitId`, and an
  append-only `SubmissionConversion` model enforces one conversion per
  Submission. M2-C6-T2 added the migration and transactional service, and
  M2-C6-T3 exposed it through the named governance API, and M2-C6-T4 added the
  capability-gated native detail action. M2-C6-T5 completed final
  idempotency/authorization coverage and operational documentation.
- **M2-C7 — M2 Final Acceptance** is `ACCEPTED`. It did not alter the completed
  M2-C1 through M2-C5 history; its evidence is in
  `docs/reports/M2-C7-FINAL-ACCEPTANCE.md`.

M2-C6 and M2-C7 are complete. M2 is accepted following documented validation,
legacy compatibility verification, and explicit user acceptance.
