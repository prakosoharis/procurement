# Refinement User Flow

Status: **ACCEPTED PRODUCT SPECIFICATION**

## Roles and authority

| Role | Display | Refinement authority |
| --- | --- | --- |
| `SUPER_USER` | Superuser (Admin) | Same operational capabilities as Tim Procurement; any supported override needs auditable reason. |
| `CORPORATE_GOVERNANCE` | Tim Procurement | Starts review; manages references/findings; changes severity/blocking; requests clarification; resolves, defers, dismisses; edits summary; completes Refinement. |
| `BUSINESS_UNIT_PIC` | Business Unit | Views only permitted BU data; responds to clarification and supports it with evidence. Cannot alter severity/blocker, disposition, completion, or finding closure. |
| `EXECUTIVE` | Executive | Read-only summary and safe finding/count information; no operational edit action. |

Capabilities must be server-derived. Browser visibility is never authorization.

## Lifecycle and workflow

`SUBMITTED → REFINEMENT → VALIDATION` remains the only SOP-version lifecycle
path. Internal work does not create lifecycle states. Derived work status may be
`NEW`, `IN_PROGRESS`, `WAITING_FOR_CLARIFICATION`, `BLOCKED`,
`READY_FOR_COMPLETION`, or `COMPLETED`, calculated from review activity,
unresolved/blocking findings, clarification, summary completeness, and
completion state.

1. Tim Procurement starts review for a version in `REFINEMENT`.
2. The reviewer selects/maintains an active Reference Set and reviews the
   document.
3. The reviewer creates human findings and can attach structured evidence.
4. A finding can request clarification from a scoped Business Unit. A response
   does not automatically resolve the finding.
5. Tim Procurement resolves, defers, dismisses, or keeps each finding open,
   producing history.
6. The reviewer writes a Refinement summary and opens the completion checklist.
7. A successful server-validated completion transitions `REFINEMENT` to
   `VALIDATION`; it does not approve or publish the SOP.

The SOP document is never directly edited inside this workspace. Document
changes belong to controlled SOP draft/version editing.
