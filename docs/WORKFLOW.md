# Business Workflows

## SOP document lifecycle

1. An authorized user creates an SOP draft with its Business Unit and metadata.
2. A draft can be edited while it remains in `DRAFT`.
3. The draft can be submitted, then moved into Human-Only Refinement.
4. Refinement is completed only after the server confirms that the required
   human findings, clarifications, and summary are ready.
5. The version moves from `REFINEMENT` to `VALIDATION`.

The version lifecycle represented in the database is:

```
DRAFT → SUBMITTED → REFINEMENT → VALIDATION → APPROVED → READY_TO_PUBLISH → PUBLISHED
```

Archived versions use `ARCHIVED`. The official published version is stored
separately from the latest working version. Creating a revision uses the
official published version as its source and creates a new draft; it does not
alter the published source.

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
