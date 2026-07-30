# M3-C1 Refinement Data Contract and API Reconciliation

Status: **COMPLETE — implementation approval required before M3-C2**

## Current repository reality

| Area | Current state | Reconciliation result |
| --- | --- | --- |
| SOP lifecycle | `SopVersion.lifecycleState` already supports `SUBMITTED → REFINEMENT → VALIDATION`; `startRefinement()` is governance-only. | Preserve this lifecycle. Do not add internal Refinement lifecycle states. |
| `RefinementJob` | AI-job-oriented model: queue/preparation/retrieval/analysis statuses, optional provider/model/prompt/configuration, and per-version records. | Do not repurpose as the Human-Only workspace session. Preserve it for AI-assisted M7 compatibility and historic evidence. |
| `RefinementFinding` | AI-candidate/Validation-decision shape: gap/recommendation/confidence/evidence JSON and `PENDING/ACCEPTED/...` human decision states. | Do not redefine its meaning as an operational Human finding. Keep it as AI/validation evidence. |
| Legacy `Finding` | Request/audit-oriented title, evidence, recommendation, risk, and `FindingStatus`. | Keep separate; it does not represent version-scoped Refinement work. |
| `ActionItem` | May link to legacy `Finding` or `RefinementFinding`; it requires an owner and title. | Do not create a second action system. Reconcile optional follow-up draft linkage before adding a new relation. |
| `ReferenceSource` | Global library record with title/type/file/link/effective date and approval fields; no session membership/history. | Retain as reusable library source; add a session-owned snapshot/link model if approved. |
| Document storage | `SopVersion` carries file metadata/key. `GET /api/files/download` provides authenticated scoped inline/download access. | Reuse secure file access; preview/search/selection is capability-dependent and must not be claimed before verification. |
| Authorization | Central roles, effective BU scope, governance services, and capability patterns already exist. | New Refinement capabilities must be server-derived and use `assertScope()`/effective scope. |
| API/error boundary | Native target is `/sop-governance/* → /api/governance/* → services`; API error and mutation helpers exist. | Build M3 only in this native boundary with allowlists and expected-state/timestamp preconditions. |

## Recommended additive data direction

The following is a **PROPOSAL**, not an implemented schema contract:

1. Add `RefinementSession` for the Human-Only workspace rather than altering
   `RefinementJob`. A session belongs to a version and BU, records its reviewer,
   mode, operational work status, summary, completion data, and timestamps.
   Versions may re-enter Refinement from Validation, so a version needs an
   explicit cycle/iteration strategy rather than a simple one-to-one relation.
2. Add a Human workspace finding model linked to `RefinementSession`, with the
   accepted primary/advanced fields, disposition data, optimistic-concurrency
   timestamp, and source. Additive status/severity enums are required because
   current `RiskLevel` lacks `OBSERVATION` and existing human statuses have
   Validation semantics.
3. Add dedicated structured `RefinementEvidence` and `RefinementClarification`
   records. This avoids placing auditable evidence, attachments, requester/BU,
   responses, and status transitions into opaque JSON.
4. Keep `ReferenceSource` as a reusable source library. Add an append-only or
   historical `RefinementSessionReference` association/snapshot so removing an
   active reference cannot erase completion evidence.
5. Use existing `AuditLog` as the mandatory cross-entity audit trail. M3-C2/C3
   queries may derive detailed history from entity/action chronology; add a
   dedicated history model only if the required drawer cannot be safely served
   from that immutable evidence.
6. Do not attach an `ActionItem` until its relationship to the new human
   finding is approved. The M3 UI may retain only the accepted lightweight
   follow-up draft fields until then.

All changes must be additive and migration-managed. Existing `RefinementJob`,
`RefinementFinding`, `Finding`, `ActionItem`, and historical AuditLog records
must remain readable and semantically unchanged.

## Lifecycle, readiness, and concurrency contract

- `POST .../start` may act only on `SUBMITTED`, by Tim Procurement/Superuser,
  inside authorized scope, and must transition through the existing lifecycle
  service to `REFINEMENT`.
- Workspace mutation requests must use a strict field allowlist plus
  `expectedState` and exact `expectedUpdatedAt` (or an approved session/finding
  revision token). A stale write is `409 CONCURRENT_MODIFICATION`; clients
  preserve unsaved input and never silently merge.
- Completion may act only on `REFINEMENT`, by Tim Procurement/Superuser, after
  server-calculated summary/reference/finding/clarification/deferred-work
  checks. It uses the existing lifecycle service for `REFINEMENT → VALIDATION`
  and writes audit evidence in the same transaction.
- Business Unit can read only scoped workspace data and respond only to a
  clarification assigned to an effective BU. Executive stays cross-BU
  read-only and receives no mutation capability.

## Proposed API boundary

The M3-C0 endpoint list remains **PROPOSED**. The recommended shape is one
native `refinement-workspace` service family behind `/api/governance/refinement`:
queue/read workspace; start; finding CRUD/disposition; clarification; reference
set; summary; completion. Final handler names, DTOs, pagination fields, and
whether disposition is action endpoints or PATCH commands remain subject to
the decision list below. No endpoint is implemented by M3-C1.

## Compatibility and migration plan

1. Add new tables/enums/nullable relations only; do not rename, drop, or rewrite
   legacy Refinement/validation records.
2. Backfill nothing automatically. Existing versions with legacy AI jobs retain
   their historical evidence and are not treated as Human-Only sessions.
3. Version-level native read DTOs may later expose a separate `refinementWorkspace`
   section without changing current success fields.
4. Apply migrations to migration-managed staging/production environments. The
   local Docker database remains `prisma db push` synchronized and lacks a
   historical Prisma migration baseline.

## Decisions required before M3-C2

1. Approve a separate additive `RefinementSession` with per-version iteration,
   rather than repurposing `RefinementJob`.
2. Approve a separate Human workspace finding model, leaving legacy `Finding`
   and AI/Validation `RefinementFinding` unchanged.
3. Approve dedicated Evidence, Clarification, and session-reference historical
   models rather than structured JSON-only storage.
4. Approve the `ActionItem` integration: add an optional relation to the new
   finding, or keep M3 follow-up as draft metadata until a later milestone.
5. Confirm the supported storage/document-preview scope (PDF inline preview,
   search, selection anchors, and Office-document fallback).
6. Approve final endpoint/DTO command structure after the proposed route list
   is reconciled with existing API conventions.
