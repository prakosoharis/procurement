# CP0 — Governance Design Baseline

Status: approved design baseline. This document creates no database migration and changes no production workflow.

## Locked platform choices

- Next.js App Router on Vercel.
- Prisma and PostgreSQL; Neon in production and local PostgreSQL in development.
- Google Drive in production and MinIO locally.
- Anthropic Claude Sonnet 4 is the future primary AI provider. OpenAI is backup-ready only and disabled by default.
- iMemo and ClickUp are integration abstractions with manual status/reference support for MVP.
- New features are native Next.js modules. The legacy iframe is frozen for maintenance and compatibility fixes only.

## Simplified role model

| Database role during CP1 | Product display | Target role |
| --- | --- | --- |
| `SUPER_USER` | Superuser (Admin) | Superuser (Admin) |
| `CORPORATE_GOVERNANCE` | Tim Procurement | Tim Procurement |
| `BUSINESS_UNIT_PIC` | Business Unit | Business Unit |
| Reserved until CP2 | Executive | Executive |

CP1 preserves the three current Prisma values for compatibility. CP2 will add `EXECUTIVE`; no user data is migrated in CP1.

## SOP version lifecycle

`SopDocument` is a stable SOP identity. `SopVersion` owns the governance lifecycle. A published version is immutable.

```text
DRAFT → SUBMITTED → REFINEMENT → VALIDATION → APPROVED → READY_TO_PUBLISH → PUBLISHED
                                  │
                                  └──────────────→ REFINEMENT

Permitted lifecycle terminal state: ARCHIVED
```

- A revision creates a new `SopVersion` in `DRAFT`.
- The existing published version remains official until a replacement is published.
- When the replacement is published, the previous official version may be archived.
- AI cannot transition versions to `APPROVED`, `READY_TO_PUBLISH`, `PUBLISHED`, or `ARCHIVED`.
- Tim Procurement is the regular approval/publish authority. Superuser publishing is emergency override only and requires reason, actor, timestamp, previous/new state, and supporting note/reference in `AuditLog`.

## Separate audit and review workflow

Audit never changes a published SOP lifecycle state. `AuditReview` is a separate future model:

```text
SCHEDULED → DUE → IN_PROGRESS → COMPLETED
                         └────→ CANCELLED
```

`REVIEW_DUE` is derived when the currently published version has `nextReviewAt <= now`; it is not a lifecycle status.

Review interval precedence:

1. SOP version-specific override.
2. SOP category configuration.
3. Business Unit configuration.
4. System default: 12 months after effective date.

The future schema stores `reviewIntervalMonths`, `nextReviewAt`, `reviewIntervalSource`, and `reviewOverrideReason`.

## Existing status migration policy

Existing `APPROVED` is not automatically converted to `PUBLISHED`. Only records with publication evidence—such as `publishedAt`, iMemo reference, official-version marker, effective publication metadata, or explicit Corporate/Superuser confirmation—may be migrated to `PUBLISHED`. Ambiguous records must be listed in a migration review report.

## Findings policy

The existing `Finding` model is retained until its operational/audit use is confirmed. Future structured AI results use `RefinementFinding`. `ActionItem` will later be able to reference either operational/audit findings or refinement findings. No destructive removal is permitted.

## Authorization baseline

All new native routes use server-side policy checks:

```text
requireUser / requirePageAccess → can(user, permission) → scopeWhere(user, resource)
```

Business Unit scoping occurs before database access, document access, and AI context construction. `User.businessUnitId` remains compatible; CP2 proposes `UserBusinessUnitScope` for multi-BU access.

## Future AI observability contract

`AiUsage` records user, Business Unit, feature, provider, model, prompt version, timestamps, latency, input/output/total tokens, `costCurrency`, `pricingVersion`, `pricingInputRate`, `pricingOutputRate`, estimated cost, success, error type, and fallback state.

`AiEvent` records operational events such as blocked scope, provider failure, invalid output, retry, and future fallback use. No provider SDK or key is used before AI checkpoints.

## Refinement fingerprint

The future fingerprint is a SHA-256 hash of canonical SOP version content hash, approved reference hashes, refinement configuration, retrieval contract version, provider/model policy, and prompt version. A completed result can be reused only if the fingerprint and authorized resource scope are identical.

## CP1 scope

Native application shell, grouped navigation, role display mapping, authorization helpers, scope helpers, native placeholder routes, and legacy iframe freeze. No Prisma migration, lifecycle field change, storage refactor, AI call, iMemo/ClickUp integration, or business workflow migration.

## CP2 scope

Role enum extension, non-destructive lifecycle/schema foundation, future multi-BU scope, validation/publishing/refinement/audit contracts, AI observability contracts, lifecycle transition service, and migration review report for ambiguous approved records.
