# M2-C6 Verification Evidence

Status: COMPLETE

## Implemented path

1. Native intake stores an approved conversion intent:
   - `CREATE_SOP` requires a requested Business Unit and no target SOP.
   - `CREATE_REVISION` requires an existing SOP and derives its requested
     Business Unit from that SOP.
2. Review makes the Submission `APPROVED`.
3. The detail API derives `canConvertSubmission` server-side.
4. The native detail action submits only the status and `updatedAt`
   preconditions to the named conversion API.
5. The serializable conversion service creates the controlled draft, immutable
   conversion record, and audit evidence in one transaction.

## Final API contract

`POST /api/governance/requests/[requestId]/conversion`

```json
{
  "expectedStatus": "APPROVED",
  "expectedUpdatedAt": "2026-07-30T00:00:00.000Z"
}
```

All lifecycle, approval, publication, storage, Business Unit, source-version,
and conversion-mode values remain server-owned. A first conversion returns 201;
an existing conversion returns the same safe result with `idempotent: true` and
HTTP 200.

## Verification matrix

| Behaviour | Evidence |
|---|---|
| New-SOP draft is atomic and unpublished | `submission-conversion-service.test.mjs` |
| Revision source is the official published version | `submission-conversion-service.test.mjs` |
| Approval/publishing evidence is not copied | `submission-conversion-service.test.mjs` |
| Existing/repeated calls are idempotent | `submission-conversion-service.test.mjs` |
| Concurrent unique-key race returns the sole result | `submission-conversion-service.test.mjs` |
| Audit failure rolls back draft and conversion records | `submission-conversion-service.test.mjs` |
| Superuser and Tim Procurement can convert cross-BU | `submission-conversion-service.test.mjs` |
| Business Unit and Executive cannot convert | `submission-conversion-service.test.mjs` |
| Stale/non-approved and forged non-published source are rejected | `submission-conversion-service.test.mjs` |
| API input allowlist and server capability | `submission-conversion-api-contract.test.mjs` |
| Native action needs both state and server capability | `submission-conversion-ui.test.mjs` |

## Operational notes

- The committed migration is
  `20260730010000_add_submission_conversion`.
- Local Docker PostgreSQL is intentionally managed by `prisma db push` and has
  no historical `_prisma_migrations` table. The local schema was synchronized,
  but the migration is not recorded as applied there.
- A migration-managed staging/production database must apply the committed
  migration through its normal deployment process before using this feature.
