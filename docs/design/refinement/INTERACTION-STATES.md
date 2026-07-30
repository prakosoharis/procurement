# Refinement Interaction and State Behaviour

Status: **ACCEPTED PRODUCT SPECIFICATION**

## Interaction rules

Use explicit **Save Finding** and **Save and Close**. Do not use full autosave
for governance decisions. Preserve unsaved form content after recoverable
errors. The compact finding representation shows title, severity, status,
blocking indicator, and owner only. Default filter is Open and Blocking;
primary filters are All, Blocking, Open, Waiting for Clarification, Resolved,
Deferred, Dismissed. Severity/source are More Filters. Secondary quick actions:
Request Clarification, Resolve, Defer, Dismiss, Change Owner.

## Completion

Completion uses a checklist drawer/modal and is server-validated. Reject it
when lifecycle is not `REFINEMENT`, actor lacks permission, summary is
incomplete, no active reference exists, a blocking finding is Open or Waiting
for Clarification, Critical/High lacks disposition, a deferred finding lacks
required detail, a clarification response is unreviewed, or the concurrency
token is stale. Success transitions `REFINEMENT → VALIDATION` and writes audit
evidence.

## Concurrency

Relevant mutations must eventually send expected lifecycle state and an expected
timestamp/revision token. Stale writes return `409 CONCURRENT_MODIFICATION`.
Clients do not silently overwrite or merge; retain unsaved content where
practical, offer reload-latest, and allow copying unsaved content. Exact fields
are an M3-C1 reconciliation responsibility.

## Accessibility

Keyboard navigation, managed drawer focus/return focus, visible focus states,
real labels, non-colour-only status, accessible button names, and
screen-reader-friendly errors are mandatory.
