# Procurement SOP Governance Platform
## Master Execution Document

**Status:** Active  
**Current phase:** PHASE 0 — Architecture Reconciliation and CP3B Hardening  
**Repository baseline:** branch `cp2a-governance-foundation`  
**Latest user-confirmed commit:** `15cb018 feat: wire governance capabilities to native actions`  

---

## 1. Purpose

This document is the single execution source of truth for the implementation agent.

The agent must read this document before changing code. Routine prompts should only instruct the agent to continue the active phase in this file.

Do not re-derive the architecture from old chat messages when this document already defines the decision.

---

## 2. Working Rules

1. Preserve existing commits. Do not amend, squash, or rewrite them unless explicitly authorized.
2. Inspect `git status`, `git diff`, and the current source before editing.
3. Never discard uncommitted work without explicit approval.
4. Work until the active slice is implemented, tested, documented, and committed.
5. Do not send progress-only responses.
6. Task size and turn length are not architecture blockers. If the runtime ends, continue from the existing working tree on the next run.
7. Stop only for a proven blocker involving destructive data risk, security failure, missing required schema, repository corruption, or an unavoidable architecture decision.
8. Do not push, deploy, connect to Neon, or alter production unless explicitly authorized.
9. Do not install or call Anthropic, OpenAI, iMemo, or ClickUp during PHASE 0 or CP3B completion.
10. Do not remove the legacy iframe until a later explicit migration checkpoint.

---

## 3. Current Product Architecture

The repository currently contains three overlapping application paths:

### A. Legacy static application

- Root route and iframe-backed application.
- Main asset: `public/procurement-governance-hub.html`.
- Must remain operational during migration.

### B. Older Next.js pages

Examples:

- `/repository`
- `/requests`
- `/refinement`
- `/validation`

These pages are not the target governance architecture. They may remain temporarily for compatibility, but no new governance feature should be added to them.

### C. Native governance application

Target routes:

- `/sop-governance/repository`
- `/sop-governance/repository/[sopId]`
- future modules under `/sop-governance/*`

Target request path:

```text
Native Next.js page
    -> /api/governance/*
    -> centralized governance services
    -> Prisma / PostgreSQL
```

The native governance route is the only target for new SOP governance work.

---

## 4. Locked Domain Decisions

### Roles

Use only:

- `SUPER_USER` — Superuser (Admin)
- `CORPORATE_GOVERNANCE` — Tim Procurement
- `BUSINESS_UNIT_PIC` — Business Unit
- `EXECUTIVE` — Executive

### Lifecycle

```text
DRAFT
-> SUBMITTED
-> REFINEMENT
-> VALIDATION
-> APPROVED
-> READY_TO_PUBLISH
-> PUBLISHED
-> ARCHIVED
```

Allowed revision loop:

```text
VALIDATION -> REFINEMENT
```

Audit review remains a separate workflow.

### Official version rule

- `SopDocument.publishedVersionId` identifies the current official version.
- A new revision creates a new `DRAFT` version.
- The current published version remains official until a replacement is successfully published.
- Published versions are immutable.

### Human authority

- AI may assist refinement later.
- AI never approves or publishes.
- Human validation is mandatory.

---

## 5. Existing Foundation

The repository already contains:

- governance schema and migrations;
- lifecycle services;
- revision service;
- publishing service foundation;
- audit review service foundation;
- governance API routes;
- native repository and SOP detail foundations;
- server-derived SOP detail capability flags;
- client capability gating committed in `15cb018`.

Do not recreate these foundations. Inspect and correct them only where this document identifies a defect.

---

# PHASE 0 — Architecture Reconciliation and CP3B Hardening

## 6. Goal

Before adding Create SOP, Edit Draft, or redesigning Refinement, reconcile the runtime architecture and fix correctness gaps in authorization, contracts, concurrency, and native routing.

PHASE 0 is complete only when all acceptance criteria in Sections 7–14 pass.

---

## 7. Native Route and Shell Reconciliation

### Required changes

1. Make `/sop-governance/repository` and `/sop-governance/repository/[sopId]` use the established native shell.
2. Apply page-level access with `requirePageAccess(Permission.SOP_REPOSITORY_VIEW)` or a compatible centralized equivalent.
3. Prefer Server Components for authentication, actor loading, and shell composition.
4. Move client-only fetching and interaction into focused child components where needed.
5. Do not query Prisma directly from client components.
6. Keep legacy iframe routes and older Next.js pages unchanged unless a compatibility defect requires a minimal fix.
7. Document the route classification:
   - legacy;
   - old Next transitional;
   - native target.

### Acceptance criteria

- Guest native repository access redirects to `/login`.
- Authorized roles render inside `NativeAppShell`.
- Native repository and detail are no longer detached standalone client pages.
- Legacy root remains operational.
- No automatic redirection from legacy routes to native routes.

---

## 8. Authorization and Multi-Business-Unit Scope

### Current defect

`UserBusinessUnitScope` exists in the schema, but runtime user loading and some scope helpers still rely only on `User.businessUnitId`.

### Required changes

1. Load `businessUnitScopes` in `currentUser()`.
2. Create one normalized helper that returns all permitted Business Unit IDs for a Business Unit actor.
3. Retain `User.businessUnitId` as backward-compatible primary scope.
4. Update:
   - `scopeWhere()`;
   - `assertBusinessUnitScope()`;
   - governance `assertScope()`;
   - capability resolution;
   - selectable Business Unit option logic later.
5. Cross-BU access remains permitted for:
   - Superuser;
   - Tim Procurement;
   - Executive read-only.
6. Business Unit users may act only within their combined primary and explicit scopes.
7. Apply scope in Prisma queries, not after loading unrestricted data.
8. Resolve the policy mismatch where `SOP_REPOSITORY_MANAGE` currently excludes Business Unit users even though approved workflow permits scoped create/edit/submit/revision.
   - Use granular operation permissions or capability/service rules.
   - Do not grant Business Unit refinement, validation decision, publishing, or cross-BU authority.

### Acceptance criteria

- A Business Unit user with two explicit scopes can read and operate only in those two BUs.
- A Business Unit user cannot discover an SOP outside all scopes.
- Capability results and service authorization agree.
- Executive remains read-only.
- No role-based permission is implemented only in the browser.

---

## 9. Governance Error and Authentication Contract

### Current defects

- Middleware returns a different API error structure.
- Some routes throw a plain `Error` with a `code` property, while the mapper recognizes only `GovernanceError`.

### Required changes

1. Make governance API authentication failures use the standard response contract:

```json
{
  "ok": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Authentication required.",
    "details": null
  },
  "meta": {
    "requestId": "..."
  }
}
```

2. Choose one consistent boundary:
   - middleware bypasses `/api/governance/*` and route-level `actor()` handles auth; or
   - middleware produces the same contract and request ID.
3. Use `GovernanceError` or approved domain helpers everywhere in governance routes.
4. Remove `Object.assign(new Error(), { code })` from governance endpoints.
5. Centralize HTTP status mapping.
6. Add missing mappings such as published-version immutability where used.
7. Never expose Prisma errors, SQL, stack traces, tokens, credentials, or internal paths.

### Acceptance criteria

- Guest governance API request returns the standard contract with request ID.
- `NOT_FOUND`, `FORBIDDEN`, `OUT_OF_SCOPE`, `INVALID_INPUT`, `INVALID_TRANSITION`, and `CONCURRENT_MODIFICATION` map correctly.
- A deliberately triggered internal error returns safe `500 INTERNAL_ERROR`.
- No governance route returns a raw `{ error: "..." }` shape.

---

## 10. Revision Source Correctness

### Current defect

The native detail action receives `latestVersion` and may use it as the revision source even when the current official published version is different.

### Required changes

1. Create Revision must use the official published version ID.
2. The client must receive a safe published-version summary or explicit revision source DTO.
3. The UI must never send `latestVersion.versionId` merely because a published version exists.
4. The API/service must verify:
   - source belongs to the requested SOP;
   - source is the current official published version, unless a future explicit override policy exists;
   - expected state is `PUBLISHED`;
   - published pointer remains unchanged after revision creation.

### Acceptance criteria

- Given an SOP with published v1 and working DRAFT v2, Create Revision uses v1 as the source.
- The new version is DRAFT.
- Published v1 remains PUBLISHED.
- `publishedVersionId` remains v1.
- Approval and publishing evidence are not copied.

---

## 11. Real Concurrency Token

### Current defect

`SopVersion` has no `updatedAt`; `uploadedAt` is currently used as if it were an update token, but metadata updates do not change it.

### Required changes

1. Add:

```prisma
updatedAt DateTime @updatedAt
```

2. Create a local Prisma migration.
3. Do not edit or squash previous migrations.
4. Backfill existing rows safely through the migration default/backfill strategy supported by PostgreSQL and Prisma.
5. Use `updatedAt` in DTOs and mutation preconditions.
6. Stop representing `uploadedAt` as `updatedAt`.
7. Perform stale-write checks atomically where practical.
8. A metadata update must produce a new `updatedAt`.

### Acceptance criteria

- Two clients load the same draft.
- Client A updates successfully.
- Client B sends the old timestamp and receives `409 CONCURRENT_MODIFICATION`.
- Client B does not overwrite Client A.
- `uploadedAt` remains the upload/creation timestamp.
- `updatedAt` changes on metadata update.

### Safety

This migration is local only during PHASE 0.

Do not connect to Neon or deploy it.

---

## 12. Repository API Contract Completion

### Current defects

The repository endpoint computes pagination information but does not return the complete metadata. Several approved filters are absent or incomplete.

### Required changes

1. Preserve existing `data` item fields.
2. Return:

```json
{
  "meta": {
    "requestId": "...",
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5,
    "capabilities": {
      "canCreateSop": true
    }
  }
}
```

3. Support and validate:
   - page;
   - pageSize;
   - search;
   - businessUnitId;
   - categoryId;
   - ownerId;
   - lifecycleState;
   - reviewStatus;
   - sortBy;
   - sortDirection.
4. Maximum page size: 100.
5. Search length must be bounded.
6. Sort and filter fields must be allowlisted.
7. Derived review status is not persisted as lifecycle state.
8. Business Unit scoping must be part of the database query.
9. Repository summary metrics may be added only if derived accurately and cheaply. They are not required for PHASE 0.

### Acceptance criteria

- Pagination metadata is correct.
- Invalid enum and sort inputs return safe validation errors.
- Business Unit actors cannot bypass scope using filters.
- Existing consumers still receive the same item DTO fields.

---

## 13. Native DTO and Capability Compatibility

### Required contract

SOP detail capability fields remain additive:

```json
{
  "data": {
    "...existingFields": "unchanged",
    "capabilities": {
      "canEditDraft": false,
      "canSubmitDraft": false,
      "canStartRefinement": false,
      "canCompleteHumanRefinement": false,
      "canCreateRevision": false
    }
  }
}
```

Repository-level Create capability remains additive under `meta.capabilities`.

### Rules

1. Do not rename or relocate existing fields during PHASE 0.
2. Client fallback for missing capability flags is deny-by-default.
3. Capabilities must be server-derived.
4. Capability flags improve UX but do not replace API authorization.
5. Do not expose session objects, JWT payloads, scope internals, or full authorization policy.

---

## 14. Test Foundation

### Current gap

The repository has pure-domain tests, but not enough route-level verification for the native governance contract.

### Required changes

Add focused integration tests using existing tooling or Node's built-in test runner. Do not introduce a large test framework solely for PHASE 0.

Test at minimum:

### Authentication and contracts

- guest governance API response;
- request ID;
- safe 500;
- domain error mappings.

### Multi-BU scope

- primary BU scope;
- explicit additional BU scope;
- denied BU;
- cross-BU governance actor;
- Executive read-only.

### Repository

- pagination metadata;
- filters;
- sorting;
- invalid inputs;
- scope cannot be bypassed.

### SOP detail and capabilities

- additive compatibility;
- deny-by-default client behavior;
- state-aware capability flags;
- Executive has no mutation capability;
- Business Unit has no refinement capability.

### Revision

- published version is used as source;
- working latest version is not used incorrectly.

### Concurrency

- first update succeeds;
- stale second update fails with 409;
- no overwrite.

### Native pages

- native shell and page authorization;
- repository renders data;
- legacy root remains available.

---

## 15. PHASE 0 Out of Scope

Do not implement during PHASE 0:

- Create SOP dialog;
- Edit Draft dialog;
- new Refinement UI;
- final validation decisions;
- ready-to-publish actions;
- publishing completion;
- audit review mutations;
- AI provider SDKs or calls;
- RAG or embeddings;
- iMemo integration;
- ClickUp integration;
- storage provider refactor;
- Neon migration;
- deployment;
- legacy removal.

---

## 16. PHASE 0 Commit Strategy

The agent may use multiple commits if runtime limits require it, but must not claim PHASE 0 complete until all acceptance criteria pass.

Suggested commits:

1. `refactor: reconcile native governance routing and scope`
2. `fix: harden governance contracts and revision source`
3. `feat: add version concurrency token`
4. `test: verify governance hardening contracts`

Do not create empty or progress-only commits.

---

## 17. PHASE 0 Validation

Run:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npm run build
git diff --check
node --test test/governance-foundation.test.mjs
```

Run any new integration test command added by PHASE 0.

Also verify manually or through tests:

- legacy root responds;
- native repository is protected and shell-wrapped;
- no credentials are serialized;
- no production environment is required.

---

## 18. PHASE 0 Completion Report

Return only after the implemented slice is committed, or after the whole phase if completed in one run.

Report:

1. branch;
2. commit hash(es);
3. working tree status;
4. files changed;
5. route/shell reconciliation;
6. multi-BU scope behavior;
7. error contract behavior;
8. revision source fix;
9. concurrency migration and behavior;
10. repository contract;
11. tests added and results;
12. Prisma validation;
13. build result;
14. `git diff --check` result;
15. legacy regression;
16. remaining PHASE 0 criteria, if runtime ended;
17. proven blockers only.

Do not start CP3B completion automatically.

---

# AFTER PHASE 0

## 19. CP3B Completion

Only after PHASE 0 approval:

- Create SOP native flow;
- Edit Draft native flow;
- repository pagination/filter UI;
- safe option endpoints;
- reusable dialogs instead of `alert`, `confirm`, and `prompt`;
- automated interaction tests;
- final CP3B documentation.

## 20. Refinement Redesign

The existing dummy Refinement UI is not a design reference.

Redesign from domain needs:

- selected SOP/version;
- source document;
- selected reference set;
- clear mode: `HUMAN_ONLY` or future `AI_ASSISTED`;
- structured findings;
- evidence and recommendation;
- human disposition;
- unresolved findings;
- refinement history;
- explicit transition to Validation.

Do not display fabricated AI output, confidence, model, usage, or evidence.

## 21. Later Sequence

Recommended order:

1. PHASE 0 — architecture reconciliation and hardening;
2. CP3B completion;
3. Refinement UX redesign, human-only first;
4. Validation workflow;
5. Publishing workflow;
6. Audit and scheduled review;
7. AI provider foundation;
8. AI-assisted refinement;
9. executive metrics and dashboard;
10. production hardening and Neon rehearsal.

---

## 22. Routine Agent Prompt

After this file is added to the repository, routine execution prompts should be short:

```text
Read docs/MASTER-EXECUTION.md.
Continue the active phase from the current working tree.
Complete the next coherent implementation slice, test it, document it, and commit it.
Do not discard existing work, do not send a progress-only response, and do not start the next phase.
```

This document, the current repository, and committed architecture decisions are the source of truth.
