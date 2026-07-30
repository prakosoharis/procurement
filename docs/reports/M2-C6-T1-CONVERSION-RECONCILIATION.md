# M2-C6-T1 — Submission Conversion Reconciliation

Status: DECISION_REQUIRED

This report records the current repository contract and the exact schema/API
decisions required before M2-C6 product code begins.

## Current approval and request contract

`SopRequest.status` is the authoritative Submission workflow. Its terminal
review states include `APPROVED` and `REJECTED`; only `APPROVED` is eligible for
conversion. The existing native review endpoint permits `SUPER_USER` and
`CORPORATE_GOVERNANCE` to set approval; Business Unit visibility is requester
scoped, and Executive is read-only.

`SopRequest.requestType` is a free-form `String`. The older UI has used
`NEW_SOP`, `REVISION`, and `EXCEPTION`, while native intake currently defaults
to `REVISION` and requires `sopDocumentId`. Therefore current data can identify
an existing-SOP revision request, but cannot safely guarantee that a new-SOP
Submission has a durable conversion intent or target Business Unit.

## Existing links and resulting gap

| Model | Current link | Gap for conversion |
|---|---|---|
| `SopRequest` | optional `sopDocumentId` | identifies a requested existing SOP only; no generated-version/result link |
| `SopDocument` | version collection and nullable `publishedVersionId` | can host the result; no back-reference to its originating Submission |
| `SopVersion` | belongs to `SopDocument` | has no originating Submission link and must not carry conversion authority |
| `AuditLog` | generic entity/action/detail | records evidence but cannot enforce idempotency |

Writing the generated document ID back into `SopRequest.sopDocumentId` is not
safe: it would overload the existing revision-target meaning and still would not
identify the generated version. No existing unique key prevents two concurrent
calls from generating two drafts.

## Recommended migration: append-only conversion record

Create a dedicated `SubmissionConversion` model and a `SubmissionConversionMode`
enum (`CREATE_SOP`, `CREATE_REVISION`). Recommended fields:

| Field | Rule |
|---|---|
| `id` | primary ID |
| `requestId` | required, `@unique`, FK to `SopRequest`; the sole idempotency authority |
| `mode` | required enum; immutable after creation |
| `sopDocumentId` | required FK to the created/target document; **not unique** because several approved Submissions may legitimately concern one SOP |
| `sopVersionId` | required FK to the generated draft; `@unique` for unambiguous traceability |
| `sourceVersionId` | nullable FK to the official published source; required only for `CREATE_REVISION`, not unique |
| `convertedById` and `convertedAt` | required audit attribution |

The relations must be added additively to `SopRequest`, `SopDocument`,
`SopVersion`, and `User`; no legacy link should be repurposed. `requestId @unique`
is mandatory. Application-only existence checks are insufficient.

## Required new-SOP intent and BU data

For a new-SOP branch, the Submission must durably state its requested Business
Unit and conversion intent before approval. A converter must not select an
arbitrary BU after approval. The recommended additive fields are:

- `SopRequest.conversionIntent`: nullable enum during migration, required for
  all new native Submissions (`CREATE_SOP` or `CREATE_REVISION`);
- `SopRequest.requestedBusinessUnitId`: required for `CREATE_SOP`, and equal to
  the linked SOP's `businessUnitId` for `CREATE_REVISION` once input validation
  is migrated.

Existing legacy rows remain compatible: they retain a null intent and are not
convertible until a governance user supplies/records a controlled migration
path. `EXCEPTION` is never convertible under M2-C6.

This recommendation requires approval in **DR-M2-01** because it changes which
metadata the Business Unit must supply for a new SOP.

## Exact idempotency and concurrency contract

The named operation is:

```text
POST /api/governance/requests/[requestId]/conversion
```

Initial conversion requires exactly these preconditions from the Submission
detail DTO:

```json
{
  "expectedStatus": "APPROVED",
  "expectedUpdatedAt": "SopRequest.updatedAt as ISO-8601"
}
```

The service uses a PostgreSQL serializable transaction:

1. Find a `SubmissionConversion` by `requestId`. If present, return its safe
   result with `idempotent: true` without creating further data.
2. Re-read the Submission in the transaction and reject a status or timestamp
   mismatch with `CONCURRENT_MODIFICATION`.
3. Authorize `SUPER_USER` or `CORPORATE_GOVERNANCE`, then enforce centralized
   effective-BU scope against the requested/target BU before any write.
4. Create the document/version outcome, then the conversion record, then
   `AuditLog`, in that order within the same transaction.
5. A uniqueness race on `requestId` rolls back its complete transaction. The
   outer boundary re-reads the sole conversion and returns it as idempotent.

No client input may set lifecycle, approval, publishing, `publishedVersionId`,
or storage/publishing evidence fields.

## Branch rules

### CREATE_SOP

The service creates `SopDocument` and initial `SopVersion` together. The
version has `lifecycleState: DRAFT`, `approvalStatus: DRAFT`, and no approval or
publishing fields. The document has `publishedVersionId: null`, `status: DRAFT`,
and no current official version.

### CREATE_REVISION

The service re-reads the target `SopDocument` in the transaction and uses only
its `publishedVersionId`. The source must belong to that document and be
`PUBLISHED`; otherwise it rejects. The existing `createRevisionFromPublished()`
validates the official source and copies only document-file/basic draft
metadata, not approval/publishing fields. It currently starts its own
transaction, so M2-C6-T2 must factor a transaction-aware internal operation or
extend it safely; it must not call it in a way that weakens atomicity.

The original published version and `SopDocument.publishedVersionId` stay
unchanged. The generated revision is always `DRAFT`.

## Required API ownership and response

Only `SUPER_USER` and `CORPORATE_GOVERNANCE` receive a server-derived conversion
capability. The UI consumes that capability; it does not infer roles. The API
input has only the concurrency preconditions and any approved server-required
metadata. It must return a safe DTO:

```json
{
  "submissionId": "...",
  "conversionId": "...",
  "sopDocumentId": "...",
  "sopVersionId": "...",
  "mode": "CREATE_SOP | CREATE_REVISION",
  "idempotent": false
}
```

## Decisions required before M2-C6-T2

1. **DR-M2-01:** approve the recommended `conversionIntent` and
   `requestedBusinessUnitId` fields for new native Submissions, including the
   rule that `EXCEPTION` cannot convert; or provide an alternative authoritative
   intake contract.
2. **DR-M2-02:** approve the recommended append-only `SubmissionConversion`
   model with `requestId @unique`; or provide an alternative schema that
   preserves the same immutable traceability and database-enforced idempotency.

Without both decisions, implementing a migration would silently select business
rules and persistent schema on the user's behalf.
