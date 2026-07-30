# Current Execution Status

## Active phase

**M2 — SOP Request & Intake**

Latest completed checkpoint: **M2-C5 Native Request Discussion and History**
Latest completed task: **M2-C5-T1 Native request discussion and history**

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

## Current next item

No further M2 checkpoint is defined or marked READY. Define and approve the
next M2 checkpoint before implementation begins; do not start M3.

## Remaining checklist

- [ ] Define the remaining M2 request-workflow checkpoint(s), if any.
- [ ] Obtain explicit milestone acceptance before marking M2 ACCEPTED.

## Accepted known limitations

- Legacy request routes remain operational and remain the source of existing
  request records during the migration.
- Native request review uses the established status model; no Refinement
  redesign or SOP conversion workflow is included in M2-C5.
- Notification delivery remains in-app through `TicketNotification`; no email
  or external delivery channel is introduced.

## Blockers

None.

## Prohibited scope

Do not start M3, change request lifecycle semantics, remove legacy routes,
push, deploy, alter Neon, or add external integrations without explicit
approval.

## Phase acceptance criteria

- [x] M0 architecture hardening is accepted.
- [x] M1 native repository core operations are accepted.
- [ ] M2 is accepted only after all M2 checkpoints are defined, completed, and
  explicitly approved.
