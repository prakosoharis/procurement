# Refinement Decisions

Status: **M3-C0 accepted product decisions; M3-C1 technical reconciliation pending**

Accepted: Human-only first mode; no AI visual artifacts; two-panel workspace;
drawer-based disclosure; no document editing; finding/evidence/reference/
clarification models; explicit save; server-enforced completion; independent
Validation; proposed APIs are not implementation commitments.

M3-C1 must reconcile, rather than reopen, these implementation questions:

1. Whether `RefinementJob` is the Refinement session or a separate session is
   required.
2. Whether `RefinementFinding` supports the accepted human fields without
   destructive change.
3. How existing `Finding` and `RefinementFinding` coexist or converge.
4. Whether evidence uses a dedicated model, structured JSON, or hybrid.
5. Whether clarification needs a dedicated model.
6. Whether Reference Set needs dedicated models and join tables.
7. Actual secure document-preview capability.
8. Whether selected-text location persists reliably for supported document types.
9. How follow-up drafts relate to existing `ActionItem` constraints.
10. Which proposed endpoints remain, merge, or rename under current conventions.
