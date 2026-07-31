# Current Execution Status

## Active phase

**M3 — Refinement Workspace Redesign — IN_PROGRESS**

Most recently completed checkpoint: **M3-C5 History, Tests, Accessibility, and Acceptance**
Most recently completed task: **M3-C5-T3 Record M3 acceptance evidence and status**

## Objective

Migrate the existing SOP request workflow into the native governance experience
without changing its established statuses or legacy source evidence.

## Completed commits

- `057e781` — unified native repository shell and page access.
- `9f7bcb2` — enforced effective multi-Business-Unit runtime scope.
- `61cb07f` — standardized governance API error contracts.
- `5434d2e` — forced revisions to originate from the official published version.
- `f6c88e2` — reconciled M2 request workflow.
- `6dabd53` — added native request list.
- `9a142bb` — added native request intake.
- `2b08e12` — added native request detail.
- `2bdb3a7` — added Human Refinement finding persistence foundation.
- `1cd2464` — added Human Refinement finding APIs.
- `ae61dc1` — added evidence and clarification flows.
- `62101ab` — added evidence UI and activity history.
- `5d34edf` — restricted clarification responses to the assigned Business Unit.
- `d280649` — completed Human Findings, evidence, clarification, and disposition.
- `3d84b4b` — completed server-validated Human-Only Refinement completion.

## Completed checklist

- [x] Native request listing respects requester visibility for Business Unit users.
- [x] Native request intake creates the established `SopRequest` record.
- [x] Native request detail exposes request context, review evidence, and message history.
- [x] Native discussion messages have server-side authorisation and safe API errors.
- [x] Business Unit users can respond only to their own request.
- [x] Superuser and Tim Procurement can respond to open requests.
- [x] Executive remains read-only for request discussions.
- [x] Approved and rejected requests are discussion read-only.
- [x] New discussion messages create notifications and audit evidence.
- [x] M2-C6 and M2-C7 delivery/acceptance boundaries are documented without
  changing completed M2 checkpoint history.

## Current next item

M3-C5 is complete: M3 workflow, accessibility, responsive behaviour, focused
tests, regression tests, and acceptance evidence are recorded. M3 is `DONE`
and awaits explicit product-owner acceptance; M4 is not started.

## Remaining checklist

- [x] M2-C6 transactional conversion service and additive migration.
- [x] M2-C6 named conversion API and server-derived capability.
- [x] M2-C6 capability-gated native detail action.
- [x] M2-C6 final integration-test and documentation tasks.
- [x] Complete M2-C7 final acceptance evidence.
- [x] Record explicit user acceptance and mark M2 ACCEPTED.
- [x] Persist accepted M3-C0 Refinement product and UX specification.
- [x] Complete M3-C1 reconciliation of current schema/services/authorization/
  storage/API architecture.
- [x] Approve M3-C1 technical decisions before starting M3-C2.
- [x] Add native scoped Refinement Queue (M3-C2-T1).
- [x] Add session, document/reference workspace, and safe workspace detail.
- [x] Complete M3-C2 Document and Reference Workspace.
- [x] Complete M3-C3 Human Findings, Evidence, and Clarification.
- [x] Complete M3-C4 Human-Only Completion.
- [x] Complete M3-C5 History, Tests, Accessibility, and Acceptance.
- [ ] Record explicit M3 product-owner acceptance before marking M3 `ACCEPTED`.

## Accepted known limitations

- Legacy Refinement entry points (`/refinement`, `/hub/refinement`, and the
  legacy dashboard menu) redirect to the native Human-Only Refinement queue;
  the retired static AI Findings prototype is no longer an active refinement
  workspace.
- Legacy request routes remain operational and remain the source of existing
  request records during the migration.
- Native request review uses the established status model. M2-C6 conversion has
  intent-aware intake, a service, API, native detail action, and verification
  coverage; M2 final acceptance is recorded.
- The local Docker database uses `prisma db push` and has no historic
  `_prisma_migrations` baseline. The committed migration is ready for a
  migration-managed environment but was not recorded as applied locally.
- Notification delivery remains in-app through `TicketNotification`; no email
  or external delivery channel is introduced.

## Blockers

None.

## Prohibited scope

Do not start M4 without explicit approval. Do not change request lifecycle
semantics, remove legacy routes, push,
deploy, alter Neon, or add external integrations without explicit approval.

## Execution cadence

User approval is granted **per checkpoint**. Once a checkpoint is approved, all
of its tasks proceed automatically through implementation, validation,
documentation, and commits. Pause only for a genuine blocker or before the next
checkpoint; do not request confirmation for individual tasks or small changes.

## Phase acceptance criteria

- [x] M0 architecture hardening is accepted.
- [x] M1 native repository core operations are accepted.
- [x] M2-C6 converts approved submissions exactly once into controlled drafts.
- [x] M2-C7 records complete evidence and explicit user approval; M2 is
  `ACCEPTED`.
