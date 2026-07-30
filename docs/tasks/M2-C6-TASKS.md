# M2-C6 — Convert Approved Submission to SOP Draft or Revision

## M2-C6-T1 — Reconcile conversion data contract and schema

Status: DONE — user accepted DR-M2-01 and DR-M2-02 on 2026-07-30

Inspect the current `SopRequest`, `SopDocument`, `SopVersion`, revision service,
request detail API/UI, and centralized authorization before modifying any product
code. Produce the final migration and DTO/API contract decision. Required output:

- map the current approval statuses and allowed conversion precondition;
- determine how `CREATE_SOP` versus `CREATE_REVISION` is represented at intake;
- select the durable one-to-one conversion link and database uniqueness rule;
- lock `expectedStatus`/`expectedUpdatedAt` concurrency and duplicate-race
  response behavior;
- resolve or explicitly retain every `DECISION_REQUIRED` item;
- document final API operation/name and allowlisted input fields.

Reconciliation evidence is in
`docs/reports/M2-C6-T1-CONVERSION-RECONCILIATION.md`. The approved schema and
business decisions now authorize M2-C6-T2.

## M2-C6-T2 — Implement transactional conversion service

Status: DONE. Added the additive `SubmissionConversion` migration and a single
serializable transactional service. The service reuses transaction-aware
official-source revision validation, creates audit evidence, and returns an
idempotent result for an existing conversion. Focused service tests verify both
conversion branches and rollback.

Implementation scope:

- `prisma/migrations/20260730010000_add_submission_conversion`;
- `lib/governance/requests/submission-conversion-service.js`;
- transaction-aware revision helper;
- focused `test/submission-conversion-service.test.mjs`.

The local Docker PostgreSQL schema was synchronized using `prisma db push`;
its pre-existing database does not contain Prisma's historical migration table.

## M2-C6-T3 — Expose secure named conversion API

Status: DONE. Added `POST /api/governance/requests/[requestId]/conversion` with
only `expectedStatus` and `expectedUpdatedAt` as input. The route delegates all
authorization, effective-BU scope, official-source, transaction, and idempotency
rules to the conversion service and returns the standard governance contract.
Submission detail now exposes the additive server-derived
`canConvertSubmission` capability; no client role inference was added.

## M2-C6-T4 — Add conversion action to approved Submission detail

Status: DONE. The native detail uses the server-provided
`canConvertSubmission` capability together with `APPROVED` state. It preserves
the existing discussion controls, handles recoverable API errors without clearing
the discussion input, refreshes the result after conversion, and links to the
generated SOP draft. No raw client role comparison was added.

## M2-C6-T5 — Add idempotency, authorization, integration tests, and documentation

Status: DONE. The focused conversion suite covers both branches, repeat and
unique-key race idempotency, non-approved/stale states, Superuser/Tim
Procurement cross-BU authority, Business Unit/Executive denial, forged sources,
rollback, API input/capability contract, and UI visibility. See
`docs/reports/M2-C6-VERIFICATION.md`.
