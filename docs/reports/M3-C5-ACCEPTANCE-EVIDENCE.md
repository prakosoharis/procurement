# M3 acceptance evidence

Milestone: **M3 — Refinement Workspace Redesign**

Implementation status: **DONE — awaiting explicit product-owner acceptance**.

## Delivered workflow

1. Authorized users see only their scoped SOP versions in the Refinement Queue.
2. Tim Procurement/Superuser operate the Human-Only workspace: references,
   structured findings, evidence, clarification, disposition, and summary.
3. Business Unit users can answer only their assigned clarification; Executive
   remains read-only.
4. The server derives every mutation capability and enforces lifecycle,
   effective BU scope, and optimistic concurrency.
5. Completion checks summary, active reference, final findings, and reviewed
   clarifications before recording the transactional transition from
   `REFINEMENT` to `VALIDATION` with audit evidence.

## Verification results

- `node --test test/refinement-accessibility.test.mjs`: 4 passing checks for
  keyboard focus, labels, live feedback, table semantics, and responsive CSS.
- `node --test test/human-refinement-workflow.test.mjs`: 7 passing Human
  Finding and role/capability checks.
- `node --test test/refinement-completion.test.mjs`: 5 passing readiness,
  authority, and concurrency checks.
- `node --test test/*.test.mjs`: 72 focused/regression tests passed.
- `npx prisma validate` and `npx prisma generate`: passed.
- `npm run build`: passed.
- `git diff --check`: passed before commit.

## Visual and responsive verification record

The verified implementation provides a desktop content width, responsive native
shell, card/toolbar reflow below 800px, and horizontally scrollable wide queue
tables. Automated source-contract tests confirm the relevant accessible markup
and responsive selectors. A local authenticated queue capture is retained at
`docs/reports/screenshots/m3-c5-refinement-queue.png`; it confirms labelled
controls, a readable empty state, and the native shell without fabricating SOP
or AI data.

## Known limitations retained

- M3 is Human-Only: no AI provider/model output, confidence, or generated
  finding is displayed or stored.
- Evidence can carry a secure attachment key, but M3 does not introduce a new
  attachment upload workflow.
- M4 Validation, approval, publishing, and milestone acceptance remain outside
  this checkpoint.
