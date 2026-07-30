# M2-C6 — Convert Approved Submission to SOP Draft or Revision

## M2-C6-T1 — Reconcile conversion data contract and schema

Status: READY

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

No product schema or source code is in scope until this task is completed and
its required decisions are resolved.

## M2-C6-T2 — Implement transactional conversion service

Status: PLANNED. Add the approved migration and a single transactional service
for both branches. Reuse `createRevisionFromPublished()` policy or factor it
safely; never weaken official-source validation. The transaction creates all
records or none, records `AuditLog`, and makes the conversion durable/idempotent.

## M2-C6-T3 — Expose secure named conversion API

Status: PLANNED. Add only the named governance operation with strict allowlisted
input, standard error contract, effective-BU authorization, server-derived
capabilities, and safe idempotent success DTO.

## M2-C6-T4 — Add conversion action to approved Submission detail

Status: PLANNED. Use the server-provided capability plus `APPROVED` state to
show a clear conversion action. Preserve existing discussion/review controls;
do not infer conversion permission from a raw client role.

## M2-C6-T5 — Add idempotency, authorization, integration tests, and documentation

Status: PLANNED. Cover each branch, concurrent/repeated calls, non-approved
state, all roles, effective-BU scope, invalid/forged target/source, immutable
published source, rollback, audit link, API contract, and UI feedback.
