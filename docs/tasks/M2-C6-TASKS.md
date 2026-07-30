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

Status: READY. Use the server-provided capability plus `APPROVED` state to
show a clear conversion action. Preserve existing discussion/review controls;
do not infer conversion permission from a raw client role.

## M2-C6-T5 — Add idempotency, authorization, integration tests, and documentation

Status: PLANNED. Cover each branch, concurrent/repeated calls, non-approved
state, all roles, effective-BU scope, invalid/forged target/source, immutable
published source, rollback, audit link, API contract, and UI feedback.
