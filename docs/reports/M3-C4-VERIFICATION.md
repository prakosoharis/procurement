# M3-C4 verification

Checkpoint: **M3-C4 Human-Only Completion**

## Validation

- `node --test test/refinement-completion.test.mjs` — 5 completion readiness,
  authority, and concurrency-contract tests pass.
- `node --test test/*.test.mjs` — 68 focused/regression tests pass.
- `npx prisma validate` and `npx prisma generate` — pass.
- `npm run build` — passes.
- `git diff --check` — passes before commit.

## Security and lifecycle evidence

Completion is available only through server-derived governance capability and
the route invokes the transactional completion service. The service verifies
effective BU scope, `REFINEMENT` state, version concurrency, active reference,
summary, final findings, and closed clarification before changing the version to
`VALIDATION`. Business Unit and Executive cannot mutate completion data.
