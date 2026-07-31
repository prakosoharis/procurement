# M3-C3 — Human Findings, Evidence, and Clarification

Status: **DONE**

M3-C3 establishes the controlled Human-Only Refinement record. It is additive:
legacy `Finding` and `RefinementFinding` records remain unchanged.

## Delivered behaviour

- A Tim Procurement user or Superuser can create and edit a structured Human
  Finding only for a SOP version in `REFINEMENT` that is inside server scope.
- Categories, severity, default blocking, an explicit blocking override reason,
  supporting evidence, optional follow-up, clarification, and disposition are
  persisted in dedicated models.
- `OTHER` category requires an explanation. Critical and High default to
  blocking; any departure requires a reason.
- A Business Unit can respond only to an open clarification assigned to one of
  its effective Business Units. It cannot create, edit, close, or dispose of a
  finding. Executive is read-only.
- Tim Procurement or Superuser can review and close a response, then resolve,
  defer, or dismiss a finding. Resolution, deferment, and dismissal have the
  required structured information.
- Mutations use `expectedUpdatedAt`; a stale write returns the established
  `CONCURRENT_MODIFICATION` error rather than overwriting a newer record.
- Every operational action writes an `AuditLog` event and the workspace exposes
  the scoped history.

## API surface

- `GET|POST /api/governance/refinement/[versionId]/findings`
- `PATCH /api/governance/refinement/[versionId]/findings/[findingId]`
- `POST /api/governance/refinement/[versionId]/findings/[findingId]/evidence`
- `POST /api/governance/refinement/[versionId]/findings/[findingId]/clarifications`
- `POST /api/governance/refinement/[versionId]/findings/[findingId]/disposition`
- `POST /api/governance/refinement/clarifications/[clarificationId]/respond`
- `POST /api/governance/refinement/clarifications/[clarificationId]/close`
- `GET /api/governance/refinement/[versionId]/history`

## Scope boundary

This checkpoint does not complete Refinement or transition a SOP to Validation.
That is exclusively M3-C4. Attachment upload UI and ActionItem creation remain
outside this checkpoint; the evidence contract accepts a secure attachment key
without exposing storage credentials.
