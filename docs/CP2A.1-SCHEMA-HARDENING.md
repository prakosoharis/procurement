# CP2A.1 — Governance Schema Hardening

This checkpoint hardens the CP2A governance schema only. It adds no workflow, UI, API, AI provider SDK, production deployment, or Neon change.

## AI cost contract

`AiUsage.estimatedCost`, `AiUsage.pricingInputRate`, and `AiUsage.pricingOutputRate` use PostgreSQL `numeric(20,10)` through Prisma `Decimal`.

- `costCurrency` is required and defaults to `USD`.
- `pricingInputRate` is USD per 1,000,000 input tokens.
- `pricingOutputRate` is USD per 1,000,000 output tokens.
- Rates are not stored as per-token floating-point values.
- `inputTokens`, `outputTokens`, `totalTokens`, and `latencyMs` remain `Int`.

Prisma `Decimal` values must not be passed blindly through JSON APIs. Future service/API code must explicitly serialize precision-sensitive Decimal values as decimal strings, for example `value.toString()`. API consumers must parse those strings with a decimal-safe library when arithmetic is needed; JavaScript `Number` is not suitable for financial reconciliation.

## Action item source invariant

`ActionItem.findingId` and `ActionItem.refinementFindingId` remain nullable for legacy compatibility and explicitly manual actions. Database constraint `ActionItem_single_finding_source_check` prohibits both values from being populated on the same row.

Future CP2B service rule, before any database write:

- Finding-generated action: exactly one of `findingId` or `refinementFindingId` is required.
- Explicitly manual action: both may be null.
- Both fields may never be populated together.

The check constraint is custom SQL because Prisma Schema Language does not represent PostgreSQL check constraints. Prisma validation validates the Prisma schema but does not model this database-only invariant; schema diff/introspection must therefore preserve and review this constraint explicitly.
