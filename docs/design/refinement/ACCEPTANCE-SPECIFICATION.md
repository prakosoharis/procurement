# Refinement Acceptance and Security Specification

Status: **ACCEPTED PRODUCT SPECIFICATION**

## Server authority

All operational capabilities, Business Unit scope, lifecycle checks, completion
rules, and concurrency checks must be server-enforced. Client hiding is not
authorization. Superuser overrides remain auditable and require reason where
the backend supports override. Executive is read-only.

## Proposed API operations

All endpoints below are **PROPOSED** and are not implemented. M3-C1 may retain,
combine, rename, or reject them according to current conventions:

- `GET /api/governance/refinement`
- `GET /api/governance/refinement/[versionId]`
- `POST /api/governance/refinement/[versionId]/start`
- `POST /api/governance/refinement/[versionId]/findings`
- `PATCH /api/governance/refinement/[versionId]/findings/[findingId]`
- `POST /api/governance/refinement/[versionId]/findings/[findingId]/resolve`
- `POST /api/governance/refinement/[versionId]/findings/[findingId]/defer`
- `POST /api/governance/refinement/[versionId]/findings/[findingId]/dismiss`
- `POST /api/governance/refinement/[versionId]/findings/[findingId]/clarifications`
- `POST /api/governance/refinement/[versionId]/findings/[findingId]/clarifications/[clarificationId]/respond`
- `POST /api/governance/refinement/[versionId]/findings/[findingId]/clarifications/[clarificationId]/close`
- `GET|POST /api/governance/refinement/[versionId]/references`
- `PATCH|DELETE /api/governance/refinement/[versionId]/references/[referenceId]`
- `PATCH /api/governance/refinement/[versionId]/summary`
- `POST /api/governance/refinement/[versionId]/complete`

## Required verification for M3-C5

- queue/workspace and responsive behaviour tests;
- role, scope, capability, and lifecycle authorization tests;
- concurrency and stale-write tests;
- HTTP integration tests and safe error contract checks;
- accessibility checks for keyboard, focus, labels, colour-independent status,
  and error announcements;
- screenshots and milestone acceptance evidence.

## Out of scope for M3-C0

No product code, route handler, schema/migration, storage integration, document
preview claim, AI provider, AI evidence, automated AI finding, approval, or
publishing change is authorized by this specification.
