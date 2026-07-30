# Current Execution Status

## Active phase

**M2 — SOP Request & Intake**

Active checkpoint: **M2-C7 M2 Final Acceptance**
Active task: **M2-C7-T1 Record M2 final acceptance evidence**

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
- [x] M2-C6 and M2-C7 delivery/acceptance boundaries are documented without
  changing completed M2 checkpoint history.

## Current next item

**M2-C7-T1 — Record M2 final acceptance evidence** is READY. M2-C6 is complete:
native intake now captures conversion intent, conversion is server-authorized
and transactional, and the final focused verification report is recorded.

## Remaining checklist

- [x] M2-C6 transactional conversion service and additive migration.
- [x] M2-C6 named conversion API and server-derived capability.
- [x] M2-C6 capability-gated native detail action.
- [x] M2-C6 final integration-test and documentation tasks.
- [ ] Complete M2-C7 final acceptance evidence.
- [ ] Obtain explicit milestone acceptance before marking M2 ACCEPTED.

## Accepted known limitations

- Legacy request routes remain operational and remain the source of existing
  request records during the migration.
- Native request review uses the established status model. M2-C6 conversion has
  intent-aware intake, a service, API, native detail action, and verification
  coverage; M2 final acceptance remains.
- The local Docker database uses `prisma db push` and has no historic
  `_prisma_migrations` baseline. The committed migration is ready for a
  migration-managed environment but was not recorded as applied locally.
- Notification delivery remains in-app through `TicketNotification`; no email
  or external delivery channel is introduced.

## Blockers

None.

## Prohibited scope

Do not mark M2 accepted without M2-C7 evidence and explicit user acceptance. Do
not start M3, change request lifecycle semantics, remove legacy routes, push,
deploy, alter Neon, or add external integrations without explicit approval.

## Phase acceptance criteria

- [x] M0 architecture hardening is accepted.
- [x] M1 native repository core operations are accepted.
- [x] M2-C6 converts approved submissions exactly once into controlled drafts.
- [ ] M2-C7 records complete evidence and explicit user approval before M2 is
  marked `ACCEPTED`.
