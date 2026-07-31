# M3-C3 verification

Checkpoint: **M3-C3 Human Findings, Evidence, and Clarification**

## Validation

- `node --test test/human-refinement-workflow.test.mjs` — 7 passing tests.
- `node --test test/*.test.mjs` — 62 passing regression and focused tests.
- `npx prisma validate` — passed.
- `npx prisma generate` — passed.
- `npm run build` — passed.
- Local Docker PostgreSQL synchronized with `prisma db push --skip-generate`.
- `git diff --check` — passed before commit.

## Authorization evidence

The server derives capabilities from permissions, lifecycle, and effective BU
scope. The client only consumes those capability flags. Tim Procurement and
Superuser receive management actions in Refinement; a scoped Business Unit can
respond to its clarification only; Executive receives no mutation controls.

## Known limitation accepted for this checkpoint

The evidence data model records a secure attachment key, but M3-C3 does not add
a new file-upload control or create an ActionItem from a follow-up suggestion.
Both remain subsequent explicitly scoped work.
