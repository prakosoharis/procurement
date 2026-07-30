# Current Execution Status

## Active phase

**M2 — SOP Request & Intake**

Active checkpoint: **M2-C1 Request Workflow Reconciliation**
Active task: **M2-C1-T1 Legacy request contract reconciliation**
Current status: **DONE**

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

## Milestone Progress

| Milestone | Status | Checkpoints | Progress |
|---|---|---:|---:|
| M0 | ACCEPTED | 0 | 100% |
| M1 | IN_PROGRESS | 5 | 0% |
| M2–M9 | PLANNED | catalogued | 0% |

## Active Checkpoint Progress

| Task | Status | Dependency | Commit | Evidence |
|---|---|---|---|---|
| M1-C1-T1 | DONE | M0 | pending | URL query state, filters, loading/error/empty states |

## Remaining checklist

- [x] Real concurrency token migration and draft-update preconditions.
- [x] Repository API pagination/filter/sort contract completion.
- [x] Route-level integration-test foundation and Phase 0 acceptance audit.

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
- [x] `updatedAt` concurrency contract is implemented.
- [x] Repository API contract is fully validated.
- [x] Focused route-level acceptance tests pass.
