# M2-C6 — Convert Approved Submission to SOP Draft or Revision

Status: READY — M2-C6-T4 complete; M2-C6-T5 is next

## Business outcome

An `APPROVED` Submission can be converted exactly once into one controlled
outcome:

1. a new `SopDocument` with an initial `DRAFT` `SopVersion`; or
2. a new `DRAFT` revision of an existing SOP, sourced from its current official
   published version.

M2-C6 does not publish, approve, or otherwise change the lifecycle of the
created draft. It is only the controlled handoff from an approved Submission
into the existing SOP lifecycle.

## Locked rules

- Only `APPROVED` `SopRequest` records can convert.
- Only `SUPER_USER` and `CORPORATE_GOVERNANCE` can convert.
- `BUSINESS_UNIT_PIC` and `EXECUTIVE` cannot convert.
- The conversion is idempotent, transactional, and creates no duplicate draft.
- A new-SOP conversion creates the document and first draft version atomically;
  `publishedVersionId` remains `null`.
- A revision conversion must use `SopDocument.publishedVersionId`, whose version
  must be `PUBLISHED`; it never uses a newer working version as the source.
- The published version is unchanged. Approval and publishing evidence are not
  copied to the new draft.
- The submission, created document, and created version must remain traceably
  linked. An `AuditLog` record is mandatory.
- Lifecycle, approval, publishing, and document status fields are server-owned
  and must never be accepted from client input.
- Scope checks use the centralized effective-BU scope before write operations;
  no unrestricted data may be loaded and filtered in memory.
- A failed conversion leaves no partial document, version, conversion record, or
  audit evidence.

## Current data-contract findings

| Concern | Current state | Consequence for M2-C6 |
|---|---|---|
| Submission approval | `SopRequest.status` has `APPROVED` | Conversion precondition can be checked server-side. |
| Existing SOP link | `SopRequest.sopDocumentId` is optional | It can identify a revision target, but does not identify the generated `SopVersion`. |
| New versus existing request | `requestType` is an unconstrained string; native intake currently requires `sopDocumentId` | New-SOP intake/conversion intent is not represented safely enough. |
| Conversion completion | No converted version, conversion time, actor, or one-to-one conversion record | A migration is required for durable tracing and idempotency. |
| SOP draft creation | `SopDocument` plus `SopVersion` can be created transactionally | New-SOP branch can use these existing models, with `publishedVersionId: null`. |
| Revision creation | `createRevisionFromPublished()` enforces the current official published source | Revision branch must reuse or safely extend this service; it must not duplicate weaker logic. |

## Required schema and idempotency contract

M2-C6-T1 has documented the final recommendation, and the user approved its
business/schema decisions. The selected shape is
an append-only `SubmissionConversion` model, with `requestId @unique`,
`sopDocumentId`, `sopVersionId`, `mode`, `convertedById`, `convertedAt`, and
appropriate foreign keys/indexes. `requestId @unique` is the database authority
that prevents duplicate conversions across concurrent requests.

The conversion API must require a Submission concurrency precondition:

- `expectedStatus: "APPROVED"`;
- `expectedUpdatedAt`: the exact `SopRequest.updatedAt` ISO value returned by
  the detail DTO.

Within a single transaction, an existing conversion is returned as the
idempotent result. Otherwise, the implementation must confirm the submission is
still approved and matches `expectedUpdatedAt`, create the controlled outcome,
write the conversion record, then write `AuditLog`. A precondition mismatch is
`CONCURRENT_MODIFICATION`; a duplicate key race re-reads and returns the sole
conversion result.

## Proposed named API

`POST /api/governance/requests/[requestId]/conversion`

Allowlisted input:

```json
{
  "mode": "CREATE_SOP | CREATE_REVISION",
  "expectedStatus": "APPROVED",
  "expectedUpdatedAt": "ISO-8601 timestamp",
  "businessUnitId": "required only for CREATE_SOP",
  "title": "required only for CREATE_SOP",
  "categoryId": "optional for CREATE_SOP",
  "documentTypeId": "optional for CREATE_SOP",
  "ownerId": "optional for CREATE_SOP",
  "initialVersionNumber": "required only for CREATE_SOP",
  "reason": "required only for CREATE_REVISION"
}
```

The API must not accept document lifecycle, published pointer, approval,
publisher, review, or storage-evidence fields. Its success DTO must return only
the submission ID, conversion ID, resulting SOP ID, resulting version ID,
conversion mode, and `idempotent` indicator.

## Task sequence

1. **M2-C6-T1** — Reconcile the conversion data contract and schema. Complete;
   its recommendations are accepted.
2. **M2-C6-T2** — Add the approved migration and transactional service. Complete.
3. **M2-C6-T3** — Add the named, server-authorized conversion API. Complete.
4. **M2-C6-T4** — Add capability-gated action UX to approved Submission detail. Complete.
5. **M2-C6-T5** — Add idempotency, role/scope, rollback, API, and UI tests;
   update operational documentation.

## Acceptance criteria

- A Submission has at most one conversion record and at most one generated
  draft outcome.
- Duplicate or concurrent conversion calls return the same result and never
  create duplicate drafts.
- New-SOP conversion produces one `SopDocument` and one `DRAFT` `SopVersion`
  with no published pointer.
- Revision conversion uses only the official published version and leaves it
  unchanged; the generated version is `DRAFT` with no copied approval or
  publishing evidence.
- Authorization and effective-BU scope are enforced in the service/API, not in
  browser role checks.
- Rollback leaves no partial records and every successful conversion has audit
  evidence.
