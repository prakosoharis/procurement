# M3-C4 — Human-Only Completion

Status: **DONE**

M3-C4 provides the only supported Human-Only Refinement completion operation.
It moves a ready SOP version from `REFINEMENT` to `VALIDATION`; it does not
approve, publish, edit the SOP document, or generate AI output.

## Server-enforced readiness

Completion requires all of the following for the current scoped Refinement
session:

- a non-empty Refinement summary;
- at least one active session reference;
- no open or waiting Human Finding; and
- no clarification that has not been reviewed and closed.

The browser receives the derived checklist but cannot assert readiness. Tim
Procurement and Superuser can save the summary and complete the session;
Business Unit and Executive remain read-only. Every write is scoped using the
central effective Business Unit rule.

## Concurrency and evidence

Summary writes use the session's `expectedUpdatedAt`. Completion uses the SOP
version's `expectedUpdatedAt` and requires `expectedState: REFINEMENT`.
The completion transaction updates the session and version, writes a completed
Human-Only `RefinementJob`, and writes session and version AuditLog evidence.
Any stale request is rejected as `CONCURRENT_MODIFICATION`.

## API surface

- `GET|PATCH /api/governance/refinement/[versionId]/summary`
- `GET /api/governance/refinement/[versionId]/readiness`
- `POST /api/governance/versions/[versionId]/refinement/complete-human`

M3-C5 remains the next checkpoint and is not started here.
