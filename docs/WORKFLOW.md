# Business Workflows

## SOP document lifecycle

1. An authorized user creates an SOP draft with its Business Unit and metadata.
2. A draft records the user who uploaded it and must be assigned to a
   Superuser or Tim Procurement reviewer.
3. The assigned reviewer can preview or download the draft before approval.
4. Only the assigned reviewer can approve the draft version; the approver and
   approval time are recorded.
5. A draft can be submitted, then moved into Human-Only Refinement.
6. Refinement is completed only after the server confirms that the required
   human findings, clarifications, and summary are ready.
7. The version moves from `REFINEMENT` to `VALIDATION`.

The version lifecycle represented in the database is:

```
DRAFT → SUBMITTED → REFINEMENT → VALIDATION → APPROVED → READY_TO_PUBLISH → PUBLISHED
```

Archived versions use `ARCHIVED`. The official published version is stored
separately from the latest working version. Creating a revision uses the
official published version as its source and creates a new draft; it does not
alter the published source.

The locked Google Drive convention places SOP files under
`SOP/<Business Unit name>/`. All SOP files for a Business Unit share its
folder; the document name and version identify each file.

## Reference-source storage

Reference sources will be stored separately from SOP files under
`Sumber Pembanding/<Penerbit atau Regulator>/<Nomor regulasi>/`. For example,
an OJK source will be stored below `Sumber Pembanding/OJK/`. Revisions of a
source remain together in its regulation-number folder. Internal sources may
add a further category such as `Best Practice` or `Hasil Audit`.

File IDs are durable database references. Reorganizing an existing
application-owned file changes only its Drive parent; it does not replace the
file, change its ID, or break preview/download records. Bulk moves require a
dry-run, idempotent folder resolution, and audit evidence.

## People and organization structure

1. An authorized user selects an existing Business Unit in **People**.
2. The current organization structure contains one active root position and
   nested child positions in a deterministic sibling order.
3. A position may remain vacant, or receive one or more dated person
   assignments. A person may have more than one assignment when explicitly
   recorded as permanent or acting.
4. Replacing an occupant ends the previous assignment; it never overwrites the
   historical record. Tenure is calculated from the recorded dates.
5. Education and certification entries belong to the reusable person profile,
   not the position node.
6. Structural, profile, and assignment mutations write an audit record. A
   position with active children cannot be archived until its children are
   moved or archived.

Business Unit users see only organization and person data in their effective
Business Unit scope and have no mutation controls. The current People
structure builder provides a scoped organization tree, root/child positions,
search, zoom, expand/collapse, deterministic sibling ordering, and server-side
move/archive safeguards. Authorized users can now create, search, edit, and
archive reusable profiles with repeatable education and certification records.
Profiles are only returned to Business Unit users when they have a current
assignment within the user's effective Business Unit scope; position assignment
management records a permanent or acting placement with a start date. Ending a
placement requires its own concurrency check and preserves the historical row;
the current organization chart derives occupancy and tenure from active rows.

## Submissions

Business Units can submit a request to create a new SOP or revise an existing
SOP. A submission records the requested change, clause reference, proposed
text, priority, and business impact.

Submission statuses are `SUBMITTED`, `IN_REVIEW`,
`REVISION_REQUIRED`, `APPROVED`, and `REJECTED`. Participants can
exchange messages while the submission remains open. New messages create
in-application notifications for the applicable users.

An approved submission can be converted once by Tim Procurement or Superuser:

- **Create SOP** creates a new SOP document and its initial draft version.
- **Create Revision** creates a draft revision from the SOP's official
  published version.

The conversion is recorded against the submission and is designed to prevent
duplicate drafts for the same submission.

## Human-only refinement

Tim Procurement or Superuser starts refinement for an eligible submitted SOP
version. The workspace supports:

- reviewing the document and selected references;
- creating and editing human findings;
- recording evidence;
- requesting, receiving, and closing Business Unit clarifications;
- resolving, deferring, or dismissing findings with recorded disposition;
- recording a refinement summary; and
- completing refinement when the server-side readiness checks pass.

Business Unit users can respond only to clarifications assigned to their
effective Business Unit scope. Executive users are read-only.

## Calendar and audit appointments

Tim Procurement and Superuser can schedule audit appointments with title,
agenda, format, location, start/end time, and audience.

Appointments can be:

- **Onsite**, **remote**, or **hybrid**;
- addressed to selected PICs, including PICs from different Business Units; or
- visible to all Business Units.

Participants receive in-application calendar visibility and can have an
attendance status of invited, confirmed, attended, or declined. Past events are
not shown as active notifications.

## Engagement

The engagement index uses the preceding 30 days of application data. Each
Business Unit is shown with four equally represented indicators:

- approved mandatory document coverage;
- submission responsiveness;
- calendar participation; and
- PIC login activity.

The score is the average of those four indicator health values. Detail exposes
the underlying counts rather than a hidden weighting scheme.

## Directory

The Directory stores user and PIC contact data. Superuser creates users and can
reset passwords. A Business Unit user is associated with a primary Business
Unit and may also receive additional Business Unit scope assignments.

## AI-assisted Refinement implementation blueprint

This section tracks the approved Refinement implementation blueprint from
`Procurement_Governance_Hub_Refinement_Implementation_Blueprint_v1.docx`
dated 2 August 2026. It is kept here as one compact project-tracking view so
implementation can be followed without adding milestone/checkpoint/task
document noise.

### Implementation baseline

- The existing management-approved interface remains the only product
  interface.
- Refinement work adds secondary tabs and functionality inside the existing
  menus only.
- The database stores structure, history, decisions, and audit trail; Google
  Drive stores immutable evidence files.
- AI may propose analysis, but Admin or Tim Procurement makes the official
  decision.
- The official SOP is never edited automatically.
- MVP PDF input accepts only searchable/text-layer PDFs; scanned/image-only
  PDFs are rejected clearly.
- Implementation proceeds one sprint at a time. Do not start the next sprint
  until the active sprint is completed and accepted.

### Scope summary

| Item | Count |
| --- | ---: |
| Epic | 1 |
| Sprints | 13 |
| Tasks | 100 |

### Current repository reconciliation

This inventory was completed for `REF-S0-T1` and `REF-S0-T2` against branch
`staging`.

#### Existing application assets to reuse

| Area | Existing implementation | Reuse decision |
| --- | --- | --- |
| Product shell | The approved interface is the static hub at `/` and `/hub/[page]`, rendered from `procurement-governance-hub (1).html` and `public/procurement-governance-hub.html`. | Keep. Refinement work must stay inside the existing Home, Submissions, Repository, Refinement, Calendar, Engagement, Insights, and Directory menus. |
| Repository UI | Repository already has secondary sections for `SOP`, `Sumber Pembanding`, and `Hubungan SOP & Sumber`. SOP Library and Document Compliance remain under `SOP`. | Reuse as the visual container for source catalog and SOP-source relationship work. |
| Refinement UI | Refinement already has secondary tabs for `Perlu Dicek Ulang`, `Proses Refinement`, `Hasil & Validasi`, and `Paket Revisi`. Current content is still mostly static/demo. | Reuse tab structure; replace tab data and actions sprint-by-sprint with real APIs. |
| Authentication | `lib/current-user.js` loads the authenticated user and Business Unit scope from the session. | Reuse. Add scope-safe data only; do not expose session details to client DTOs. |
| Authorization | `lib/authorization/roles.js`, `permissions.js`, `scope.js`, and governance authorization helpers enforce role and BU-scope policy. | Reuse. All new Refinement APIs/tasks must use server-side permission and effective BU scope. |
| Storage | `lib/storage.js` and `lib/google-drive.js` use Google Drive as the private document store. | Reuse for original source PDFs, SOP files, attachments, and evidence files. |
| Governance API contract | `lib/api/governance.js` returns `{ ok, data/error, meta.requestId }` and maps safe domain errors. | Reuse for new `/api/governance/*` routes. |
| Audit trail | `AuditLog` and `lib/governance/activity/governance-audit-log.js` record governance events. | Reuse for source validation, linking, runs, decisions, and revision proposal actions. |
| SOP lifecycle | `SopDocument`, `SopVersion`, official `publishedVersionId`, lifecycle services, submission conversion, and revision services already exist. | Reuse. Revision proposals must integrate with the existing controlled draft/revision flow. |
| Human-only refinement | `RefinementSession`, `HumanRefinementFinding`, `HumanRefinementEvidence`, `RefinementClarification`, and related governance routes already exist. | Reuse where it fits. AI-assisted Refinement must not duplicate the human workspace; it should extend the same domain carefully. |
| Existing AI tracking shell | `AiUsage`, `AiEvent`, `AiProvider`, and `AiFeature` exist. | Reuse for provider usage, failures, fallbacks, and auditability. |
| Tests | Existing Node tests cover governance errors, route contracts, multi-BU scope, submission conversion, edit draft, and human refinement workflow. | Reuse patterns for focused sprint tests. |

#### Logical blueprint mapping to current schema

| Blueprint entity | Current repository mapping | Status |
| --- | --- | --- |
| `ReferenceSource` | Existing `ReferenceSource` with title/type/fileKey/sourceUrl/effectiveDate/contentHash/isApproved/approvedAt. | Reuse and likely extend. |
| `ReferenceSourceVersion` | No dedicated model found. Existing `ReferenceSource` has some version-like fields only. | Additive migration likely required. |
| `ReferenceSection` | No model found for parsed source sections, hierarchy, page ranges, full-text, or embeddings. | Additive migration required. |
| `SourceValidation` | Partially represented by `ReferenceSource.isApproved` and `approvedAt`; no validator or notes. | Extend or add related model. |
| `SopSourceRelation` | No durable SOP-to-source relationship model found. `RefinementSessionReference` links a source to a session only. | Additive migration required. |
| `SourceChangeSet` | No model found. | Additive migration required. |
| `RecheckItem` | No model found. Current Refinement tab is static/demo. | Additive migration required. |
| `RefinementGroup` | Partially maps to `RefinementSession`, but current mode is `HUMAN_ONLY` and not multi-source AI orchestration. | Reuse/extend carefully. |
| `RefinementRun` | Existing `RefinementJob` is close to an atomic run and already records provider/model/prompt/status. | Reuse and extend for one SOP version × one source version × one method version. |
| `RetrievalCandidate` | No model found. | Additive migration required. |
| `CoverageItem` | No model found; existing Document Compliance coverage is unrelated. | Additive migration required. |
| `RawAiResult` | No dedicated immutable raw-provider-output model found. `AiUsage` tracks usage only. | Additive migration required. |
| `RunFinding` | Existing `RefinementFinding` maps to AI candidate finding from a job. | Reuse and extend evidence/location fields if needed. |
| `ConsolidatedFinding` | Existing `HumanRefinementFinding` maps to human-facing findings but is not explicitly linked to multiple AI run findings. | Reuse/extend or add relation table. |
| `FindingEvidence` | Existing `HumanRefinementEvidence` supports evidence records. | Reuse and extend only if source/SOP section linkage is needed. |
| `FindingDecision` | Existing `ValidationDecision` is version-level and linked optionally to `RefinementFinding`; human-only dispositions also exist on `HumanRefinementFinding`. | Reconcile before implementing REF-S8. |
| `RevisionProposal` | No dedicated model found. Existing submission conversion and revision service create controlled drafts. | Additive migration likely required; must reuse existing revision service. |
| `AuditEvent` | Existing `AuditLog` is the app audit trail; `AuditEvent` is calendar-specific and should not be reused for governance audit events. | Use `AuditLog` for governance. |

#### Technical gaps identified for later REF-S0 tasks

| Gap | Affected task |
| --- | --- |
| Trigger.dev packages/config/tasks are installed and initialized with a smoke task. | `REF-S0-T3` |
| `pdfjs-dist` is installed with a Node/Trigger-safe text extraction helper and a searchable-PDF smoke task. | `REF-S0-T4` |
| pgvector is enabled by a dedicated migration and verified with a temporary vector insert and `<->` similarity query. No embedding field is added before the source-section model work. | `REF-S0-T5` |
| Anthropic structured-output and OpenAI embedding adapters are installed, dependency-injected for tests, and remain server-only. | `REF-S0-T6` |
| Environment validation, provider variables, live-smoke safeguards, setup documentation, and regression validation are available. | `REF-S0-T7` |

### Sprint summary

| Status | Sprint | Task count | Outcome |
| --- | --- | ---: | --- |
| Done | `REF-S0` — Repository Reconciliation and Technical Setup | 7 | Trigger.dev, searchable-PDF inspection, pgvector, AI provider foundations, environment validation, documentation, and regression checks are complete. |
| Pending | `REF-S1` — Source Catalog Foundation | 7 | To be implemented and accepted sprint-by-sprint. |
| Pending | `REF-S2` — Searchable PDF Upload, Parsing, and Structure Validation | 9 | To be implemented and accepted sprint-by-sprint. |
| Pending | `REF-S3` — Source Activation, Embeddings, and Version Change Detection | 8 | To be implemented and accepted sprint-by-sprint. |
| Pending | `REF-S4` — SOP-Source Relationships and Periodic Schedule | 7 | To be implemented and accepted sprint-by-sprint. |
| Pending | `REF-S5` — Recheck Queue and Refinement Orchestration | 8 | To be implemented and accepted sprint-by-sprint. |
| Pending | `REF-S6` — Retrieval and Coverage Report | 9 | To be implemented and accepted sprint-by-sprint. |
| Pending | `REF-S7` — AI Gap Analysis and Evidence-Backed Candidate Findings | 8 | To be implemented and accepted sprint-by-sprint. |
| Pending | `REF-S8` — Finding Consolidation, Conflict Detection, and Human Validation | 8 | To be implemented and accepted sprint-by-sprint. |
| Pending | `REF-S9` — Revision Proposal Package and Controlled Draft Handoff | 7 | To be implemented and accepted sprint-by-sprint. |
| Pending | `REF-S10` — Real Dashboard and Insights | 6 | To be implemented and accepted sprint-by-sprint. |
| Pending | `REF-S11` — Security, Reliability, Performance, and End-to-End Hardening | 8 | To be implemented and accepted sprint-by-sprint. |
| Pending | `REF-S12` — Pilot, User Acceptance, and Production Release | 8 | To be implemented and accepted sprint-by-sprint. |

### Task tracking

Status values: `Pending`, `In Progress`, `Done`, or `Blocked`. A task is
`Done` only after implementation, tests, documentation, validation, and commit
evidence are complete for the sprint.

#### REF-S0 — Repository Reconciliation and Technical Setup

| Status | Task | Description |
| --- | --- | --- |
| Done | `REF-S0-T1` | Inspect existing Next.js routes, iframe/static UI, Prisma schema, authorization, Google Drive integration, API conventions, tests, and deployment configuration. |
| Done | `REF-S0-T2` | Create a keep/reuse inventory and map logical entities in this blueprint to existing models; identify additive migrations only. |
| Done | `REF-S0-T3` | Initialize Trigger.dev in the existing repository, configure project/environment keys, and add a tested hello-world task. |
| Done | `REF-S0-T4` | Install and smoke-test pdfjs-dist in a Trigger.dev task using one searchable PDF. `refinement-pdf-smoke` extracts page text without a browser worker and rejects files below the configured text threshold. |
| Done | `REF-S0-T5` | Enable pgvector in development/staging and verify vector insert and similarity query. Local Docker uses PostgreSQL 16 with pgvector; staging applied `CREATE EXTENSION IF NOT EXISTS vector` through Prisma migration and passed the same smoke test. |
| Done | `REF-S0-T6` | Create provider abstractions and smoke tests for Anthropic structured output and OpenAI embeddings. Providers are dependency-injected, validate inputs/outputs, and never expose credentials to the client. |
| Done | `REF-S0-T7` | Add environment validation, setup documentation, regression build, and coherent commits. `env:check` is non-billable; `ai:smoke` is explicitly opt-in and validates both providers with live credentials. |

#### REF-S1 — Source Catalog Foundation

| Status | Task | Description |
| --- | --- | --- |
| Pending | `REF-S1-T1` | Implement/reconcile source identity, source version, validation, status, checksum, and audit data models. |
| Pending | `REF-S1-T2` | Implement source catalog read services, search, filters, pagination, and safe DTOs. |
| Pending | `REF-S1-T3` | Implement create/update source draft with mandatory metadata validation. |
| Pending | `REF-S1-T4` | Implement inactivate/archive behavior without hard delete. |
| Pending | `REF-S1-T5` | Integrate Repository secondary tabs into the existing UI without redesign. |
| Pending | `REF-S1-T6` | Implement source catalog table, empty/loading/error states, and role-based actions. |
| Pending | `REF-S1-T7` | Add authorization, multi-BU scope, API integration tests, UI tests, and sprint evidence. |

#### REF-S2 — Searchable PDF Upload, Parsing, and Structure Validation

| Status | Task | Description |
| --- | --- | --- |
| Pending | `REF-S2-T1` | Implement secure PDF upload to Google Drive and create DRAFT SourceVersion atomically. |
| Pending | `REF-S2-T2` | Validate PDF signature, MIME, size, checksum, and searchable text threshold. |
| Pending | `REF-S2-T3` | Implement process-source-pdf Trigger.dev task with pdfjs-dist page text extraction. |
| Pending | `REF-S2-T4` | Implement deterministic TypeScript structure parser with ordering, hierarchy, page, and location data. |
| Pending | `REF-S2-T5` | Calculate parser confidence and produce review warnings for complex/ambiguous structure. |
| Pending | `REF-S2-T6` | Implement admin structure editor and manual correction audit trail. |
| Pending | `REF-S2-T7` | Implement optional manual AI structure suggestion for low-confidence documents; never auto-accept the suggestion. |
| Pending | `REF-S2-T8` | Implement metadata + structure validation gate and MENUNGGU_VALIDASI state. |
| Pending | `REF-S2-T9` | Add parser fixtures for Indonesian regulatory patterns, idempotency tests, task tests, and UI UAT evidence. |

#### REF-S3 — Source Activation, Embeddings, and Version Change Detection

| Status | Task | Description |
| --- | --- | --- |
| Pending | `REF-S3-T1` | Implement atomic source validation and activation with role, metadata, structure, checksum, and concurrency checks. |
| Pending | `REF-S3-T2` | Implement full-text indexing for validated sections. |
| Pending | `REF-S3-T3` | Implement generate-section-embeddings task using provider abstraction and pgvector. |
| Pending | `REF-S3-T4` | Implement source-version relationship and deterministic section alignment/diff. |
| Pending | `REF-S3-T5` | Implement change-set review showing added, modified, and deleted sections. |
| Pending | `REF-S3-T6` | Require admin confirmation before activating a new version and publishing its change set. |
| Pending | `REF-S3-T7` | Reuse unchanged embeddings and regenerate only changed/new section embeddings. |
| Pending | `REF-S3-T8` | Add activation, versioning, embedding, diff, concurrency, and audit tests. |

#### REF-S4 — SOP-Source Relationships and Periodic Schedule

| Status | Task | Description |
| --- | --- | --- |
| Pending | `REF-S4-T1` | Implement/reconcile many-to-many SOP-source relation with actor, reason, active state, dates, and audit. |
| Pending | `REF-S4-T2` | Implement relation list/search/create/inactivate services and APIs. |
| Pending | `REF-S4-T3` | Implement Repository → Hubungan SOP & Sumber UI inside existing interface. |
| Pending | `REF-S4-T4` | Implement schedule configuration per SOP: monthly default, quarterly, or trigger-only. |
| Pending | `REF-S4-T5` | Prevent duplicate active relations and use effective BU authorization. |
| Pending | `REF-S4-T6` | Expose safe linked-source selector contract for Refinement. |
| Pending | `REF-S4-T7` | Add authorization, uniqueness, history, and UI tests. |

#### REF-S5 — Recheck Queue and Refinement Orchestration

| Status | Task | Description |
| --- | --- | --- |
| Pending | `REF-S5-T1` | Implement periodic-recheck-scan task using schedules and source-version metadata only. |
| Pending | `REF-S5-T2` | Implement RecheckItem uniqueness and actions: Jalankan sekarang, Jadwalkan, Abaikan with reason. |
| Pending | `REF-S5-T3` | Implement in-app notification for Admin and Tim Procurement. |
| Pending | `REF-S5-T4` | Implement Refinement creation form with SOP version, selected linked sources, full/limited scope, and reason for limited scope. |
| Pending | `REF-S5-T5` | Implement RefinementGroup and atomic RefinementRun creation transaction. |
| Pending | `REF-S5-T6` | Implement per-group Trigger.dev queue with sequential source runs. |
| Pending | `REF-S5-T7` | Implement cache key, successful-result reuse, rerun reason, cancellation, and progress status. |
| Pending | `REF-S5-T8` | Add schedule, idempotency, queue, reuse, role, and UI tests. |

#### REF-S6 — Retrieval and Coverage Report

| Status | Task | Description |
| --- | --- | --- |
| Pending | `REF-S6-T1` | Implement normalized full-text search over SOP and source sections. |
| Pending | `REF-S6-T2` | Implement vector similarity search over validated section embeddings. |
| Pending | `REF-S6-T3` | Implement retrieval fusion using metadata, changed sections, keyword, full-text, vector, reference links, previous mappings, and neighboring context. |
| Pending | `REF-S6-T4` | Persist RetrievalCandidate signals and an explanation of why each pair was selected. |
| Pending | `REF-S6-T5` | Implement CoverageItem creation for full and limited scopes. |
| Pending | `REF-S6-T6` | Implement coverage UI: checked, no pair, not checked, manual review, failed, manually added. |
| Pending | `REF-S6-T7` | Implement manual mapping by selecting existing source section + SOP section + reason; no free-text location replacement. |
| Pending | `REF-S6-T8` | Block completion when mandatory coverage remains unresolved. |
| Pending | `REF-S6-T9` | Add retrieval evaluation fixtures, bias/recall tests, authorization, and UI tests. |

#### REF-S7 — AI Gap Analysis and Evidence-Backed Candidate Findings

| Status | Task | Description |
| --- | --- | --- |
| Pending | `REF-S7-T1` | Define versioned analysis-method contract, prompt, retrieval version, and structured output schema. |
| Pending | `REF-S7-T2` | Implement Anthropic provider adapter with timeout, error classification, usage capture, and safe structured-output validation. |
| Pending | `REF-S7-T3` | Implement OpenAI analysis fallback adapter but keep automatic fallback disabled by default. |
| Pending | `REF-S7-T4` | Implement run-refinement-pair task: cache lookup, retrieval, batch sizing, analysis, persistence, coverage update. |
| Pending | `REF-S7-T5` | Persist immutable raw provider output separately from normalized candidate findings. |
| Pending | `REF-S7-T6` | Require evidence fields: SOP section, source section, article/clause/page, quote, relationship justification. |
| Pending | `REF-S7-T7` | Implement manual retry and BELUM_LENGKAP handling without deleting successful sibling runs. |
| Pending | `REF-S7-T8` | Add prompt-contract tests, malformed-output tests, provider-failure tests, no-data-leak tests, and golden fixtures. |

#### REF-S8 — Finding Consolidation, Conflict Detection, and Human Validation

| Status | Task | Description |
| --- | --- | --- |
| Pending | `REF-S8-T1` | Implement consolidation readiness rules across all atomic runs. |
| Pending | `REF-S8-T2` | Implement deterministic duplicate candidate grouping using SOP location, category, normalized text, and similarity. |
| Pending | `REF-S8-T3` | Implement optional AI consolidation suggestion only for ambiguous groups; preserve all original run findings. |
| Pending | `REF-S8-T4` | Implement source-conflict detection and explicit conflict evidence display. |
| Pending | `REF-S8-T5` | Implement consolidated finding list/detail drawer in the existing UI. |
| Pending | `REF-S8-T6` | Implement append-only human decisions VALID, REVISI, ABAIKAN with mandatory fields. |
| Pending | `REF-S8-T7` | Implement completion rules, lock, reopening/new-result-version with reason, and audit timeline. |
| Pending | `REF-S8-T8` | Add decision, conflict, deduplication, concurrency, authorization, and UI tests. |

#### REF-S9 — Revision Proposal Package and Controlled Draft Handoff

| Status | Task | Description |
| --- | --- | --- |
| Pending | `REF-S9-T1` | Implement RevisionProposal generation from validated REVISI findings. |
| Pending | `REF-S9-T2` | Implement proposal item structure: SOP location, old text, proposed text, justification, impact, sources, validator. |
| Pending | `REF-S9-T3` | Implement human edit/accept/reject actions with reasons and concurrency protection. |
| Pending | `REF-S9-T4` | Implement package UI inside Refinement → Paket Revisi. |
| Pending | `REF-S9-T5` | Integrate with the existing controlled SOP revision/draft service; do not invent a duplicate revision system. |
| Pending | `REF-S9-T6` | Preserve official published version and trace revision draft back to Refinement/finding evidence. |
| Pending | `REF-S9-T7` | Add transaction, authorization, version-source, regression, and UAT tests. |

#### REF-S10 — Real Dashboard and Insights

| Status | Task | Description |
| --- | --- | --- |
| Pending | `REF-S10-T1` | Define every KPI formula, source table, period filter, BU scope, and drill-down target. |
| Pending | `REF-S10-T2` | Implement server-side aggregation for recheck items, running Refinements, waiting validation, incomplete, completed, and revision proposals. |
| Pending | `REF-S10-T3` | Replace existing Home dummy data without redesigning the approved layout. |
| Pending | `REF-S10-T4` | Implement Insights metrics: duration, findings by category/source/BU, decision distribution, reuse rate, run failure, coverage gaps. |
| Pending | `REF-S10-T5` | Implement period/BU filters, pagination, empty states, and read-only Executive scope. |
| Pending | `REF-S10-T6` | Add aggregation reconciliation tests against detail records and performance tests. |

#### REF-S11 — Security, Reliability, Performance, and End-to-End Hardening

| Status | Task | Description |
| --- | --- | --- |
| Pending | `REF-S11-T1` | Complete authorization matrix and query-level BU scope tests for every endpoint/task. |
| Pending | `REF-S11-T2` | Implement standardized safe errors, non-disclosure behavior, and secure file access. |
| Pending | `REF-S11-T3` | Complete optimistic concurrency and idempotency across upload, activation, run, decision, and draft creation. |
| Pending | `REF-S11-T4` | Complete append-only audit events and operational task observability. |
| Pending | `REF-S11-T5` | Add performance limits, pagination, batching, max duration, provider rate handling, and large searchable-PDF tests. |
| Pending | `REF-S11-T6` | Add complete HTTP integration, Trigger.dev task, UI interaction, regression, accessibility, and responsive tests. |
| Pending | `REF-S11-T7` | Run security review for credentials, public Drive URLs, raw model output, prompt injection, and cross-BU leakage. |
| Pending | `REF-S11-T8` | Run production build, migration rehearsal, rollback rehearsal, and staging smoke test. |

#### REF-S12 — Pilot, User Acceptance, and Production Release

| Status | Task | Description |
| --- | --- | --- |
| Pending | `REF-S12-T1` | Select pilot scope: at least two official SOPs, three external/internal sources, and one new source version. |
| Pending | `REF-S12-T2` | Prepare validated source metadata, source sections, SOP-source relations, user roles, and expected findings. |
| Pending | `REF-S12-T3` | Run formal Admin and Tim Procurement UAT using the master checklist. |
| Pending | `REF-S12-T4` | Compare AI candidate findings against human expected results and document misses/false positives. |
| Pending | `REF-S12-T5` | Tune retrieval thresholds and prompts through versioned configuration; never overwrite previous run history. |
| Pending | `REF-S12-T6` | Finalize production environment, Trigger.dev Hobby plan, alerts, log ownership, support path, and rollback procedure. |
| Pending | `REF-S12-T7` | Perform production deployment, smoke test, and controlled enablement. |
| Pending | `REF-S12-T8` | Collect formal acceptance evidence and close the epic only after user approval. |

### Master acceptance checklist

- [ ] Admin uploads a searchable POJK PDF; scan-only PDF is rejected clearly.
- [ ] Original PDF is stored securely in Google Drive without an unrestricted
  public URL.
- [ ] Page text and BAB/Pasal/Ayat/Klausul structure are extracted and
  reviewable.
- [ ] Complex structure can be corrected manually; optional AI suggestion
  requires human approval.
- [ ] Source metadata and structure are validated before activation.
- [ ] Source sections are searchable by full text and semantic similarity.
- [ ] A new source version shows confirmed additions, changes, and deletions
  without deleting the previous version.
- [ ] Active source can be linked to an SOP with justification and schedule.
- [ ] Periodic check detects new source versions using database data only and
  does not call reasoning AI.
- [ ] User can run one SOP against multiple linked sources; each source becomes
  a separate sequential atomic run.
- [ ] Identical successful run is reused and does not call reasoning AI again.
- [ ] Coverage report shows every required source section and unresolved state.
- [ ] Admin can add a structured manual source-section/SOP-section mapping with
  reason.
- [ ] AI candidate finding includes exact SOP location, source location,
  article/clause/page, quote, gap, impact, recommendation, and proposed
  wording.
- [ ] Duplicate findings are consolidated while original run findings remain
  traceable.
- [ ] Source conflicts are displayed and decided by a human.
- [ ] Admin or Tim Procurement can decide VALID, REVISI, or ABAIKAN with
  mandatory justification.
- [ ] Refinement cannot finish while required run, coverage, or decision remains
  unresolved.
- [ ] Completed Refinement is locked; reopening/versioning preserves old
  history.
- [ ] REVISI decisions generate a controlled revision package and draft without
  changing the official SOP.
- [ ] Dashboard and Insights use real, reconcilable data.
- [ ] Cross-BU access, Executive read-only access, concurrency, idempotency, and
  audit tests pass.
- [ ] Production deployment and rollback are proven in staging and accepted by
  the user.
