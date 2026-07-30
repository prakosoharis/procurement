# M3 — Refinement Workspace Redesign

Status: **IN_PROGRESS**. M3-C0 product/UX specification and M3-C1 technical
reconciliation are complete. Product implementation has not started.

## Business outcome

Tim Procurement can perform a clear, structured, and auditable Refinement of an
SOP version: review against selected references, record and resolve findings,
request Business Unit clarification, prepare a summary, then send the result to
independent Validation. The first mode is **HUMAN_ONLY**. Future AI assistance
must use the same workspace and governance model; AI never makes a final
governance decision.

## Implementation dependencies

- M1 is accepted.
- M3-C0 Product and UX Specification is accepted.
- M3-C1 must reconcile this design with the actual schema, services,
  authorization, storage, and API architecture before product code begins.

## Checkpoint catalog

| Checkpoint | Status | Outcome |
| --- | --- | --- |
| M3-C0 Product and UX Specification | ACCEPTED | Product, UX, roles, and controls are explicitly defined. |
| M3-C1 Data Contract and API Reconciliation | DONE | Reconciled repository reality; additive implementation decisions remain pending. |
| M3-C2 Document and Reference Workspace | PLANNED | Build queue, workspace shell, safe document area, and reference set. |
| M3-C3 Human Findings, Evidence, and Clarification | PLANNED | Build human finding workflow, evidence, clarification, history, and capabilities. |
| M3-C4 Human-Only Completion | PLANNED | Build summary, readiness, server-side completion, and audit trail. |
| M3-C5 History, Tests, Accessibility, and Acceptance | PLANNED | Complete verification, accessibility, responsive evidence, and milestone acceptance. |

## Locked product boundaries

- Refinement is not approval; Validation is a separate, independent next stage.
- The SOP document is not edited in this workspace. Findings and
  recommendations are recorded here; actual revision remains controlled by SOP
  draft editing and versioning.
- Do not reuse the rejected dummy Refinement UI, fake data, fake AI output, or
  misleading AI visual language.
- HUMAN_ONLY must not show provider names, token usage, confidence scores, AI
  findings, or synthetic AI evidence.
- Proposed routes and data contracts remain **PROPOSED** until M3-C1.

The accepted product specification is indexed under
`docs/design/refinement/` and M3-C0 evidence is in
`docs/checkpoints/M3-C0-PRODUCT-UX.md`. M3-C1 evidence is in
`docs/reports/M3-C1-RECONCILIATION.md`.
