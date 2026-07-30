# Refinement Information Architecture

Status: **ACCEPTED PRODUCT SPECIFICATION**

## Proposed native routes

These routes are **PROPOSED**, not implemented:

- `/sop-governance/refinement` — Refinement Queue
- `/sop-governance/refinement/[versionId]` — Refinement Workspace

## Queue

The queue is operational rather than a card-heavy dashboard. Primary columns:

1. SOP
2. Business Unit
3. Version
4. Blocking Findings
5. Status
6. Last Activity
7. Reviewer

Row expansion or a drawer may reveal category, total findings, clarification
state, mode, and severity distribution. It supports pagination, server-side
search, Business Unit/work-status/reviewer/blocking/severity filters, and
last-activity sorting. Prioritize blocking findings, pending clarification,
Critical/High severity, stale work, then ready-for-completion work.

## Workspace

The default desktop workspace has two visible panels only:

`Document | Findings`

Finding detail, add/edit, evidence, references, clarification, resolution, and
detailed history use a right-side drawer. Summary, References, and History are
lower tabs or collapsible sections. Only one contextually relevant action is
primary (for example Start Review, Add Finding, or Complete Refinement);
secondary actions are contextual menus/drawers.

## Document panel

Where verified storage and preview support exists, show file/version identity,
page/section navigation, search, zoom, selection highlighting, linked-finding
markers, and secure open/download. Findings may originate from selected text,
page, section, clause, or manual location note. If preview is not supported,
show safe metadata and secure open/download with manual location entry; never
fabricate preview capability.

## Responsive behaviour

- Desktop: document and findings visible; drawer on the right.
- Laptop: adaptable/resizable two-panel layout.
- Tablet: Document, Findings, Summary tabs; drawer becomes overlay.
- Initial mobile scope: summary, read-only findings, clarification response,
  and activity. Complex finding editing is not required.
