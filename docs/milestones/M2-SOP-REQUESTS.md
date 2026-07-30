# M2 — SOP Request & Intake

Status: IN_PROGRESS. The legacy request model (`SopRequest`, discussion messages, notifications, and request statuses) remains the source of business evidence. Native migration begins with reconciliation before any request state behavior changes.

Completed native checkpoints: list, intake, detail/review, and chronological
discussion history.

## Remaining delivery path

- **M2-C6 — Convert Approved Submission to SOP Draft or Revision** is `READY`.
  It supplies the missing controlled handoff from an approved Submission to
  either a new SOP draft or an official-source revision draft. Its initial
  reconciliation task is documentation/design only; product code awaits the
  schema and business decisions recorded in `docs/DECISIONS-REQUIRED.md`.
- **M2-C7 — M2 Final Acceptance** is `PLANNED` and now owns final milestone
  acceptance. It does not alter the completed M2-C1 through M2-C5 history.

M2 remains in progress until M2-C6 is complete, M2-C7 evidence is recorded, and
the user explicitly accepts the milestone.
