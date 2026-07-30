# Implementation status

## Active phase

**PHASE 0 — Architecture Reconciliation & CP3B Hardening**

Objective: reconcile the native governance runtime, authorization, API contracts, concurrency, and repository correctness before adding further governance UX.

## Completed commits

- `057e781` — unified native repository shell and page access.
- `9f7bcb2` — enforced effective multi-Business-Unit runtime scope.
- `61cb07f` — standardized governance API error contracts.
- `5434d2e` — forced revisions to originate from the official published version.

## Completed checklist

- [x] Repository route tree uses shared authenticated native shell.
- [x] Business Unit primary and explicit scopes are unioned and enforced in queries/services/capabilities.
- [x] Governance API middleware and route errors have safe request-ID contracts.
- [x] Revision UI uses `publishedVersion`; service verifies it is the current official source.

## Current next item

Add a real `SopVersion.updatedAt` concurrency token and apply it to draft update preconditions. This requires a local-only migration and focused stale-write tests.

## Remaining checklist

- [ ] Real concurrency token migration and atomic stale-write checks.
- [ ] Repository API pagination/filter/sort contract completion.
- [ ] Route-level integration-test foundation and Phase 0 acceptance audit.

## Accepted known limitations

- Legacy iframe remains operational and is not redirected.
- Native repository actions remain API-authorized; UI capability flags only improve visibility.
- No approval, publishing, audit mutation, AI, iMemo, ClickUp, or Neon activity is included in Phase 0.

## Blockers

None. `.DS_Store` is a user-owned local modification and is intentionally excluded from commits.

## Prohibited scope

Do not start the next phase without approval. Do not push, deploy, alter Neon, remove legacy routes, add AI/provider integrations, or redesign Refinement during Phase 0.

## Phase acceptance criteria

- [x] Native repository routes have one shared shell/access boundary.
- [x] Multi-BU scope is enforced consistently server-side.
- [x] Governance errors use a standard safe contract.
- [x] Revision source is the official published version.
- [ ] `updatedAt` concurrency contract is implemented.
- [ ] Repository API contract is fully validated.
- [ ] Focused route-level acceptance tests pass.
