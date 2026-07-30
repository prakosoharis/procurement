# Finding, Evidence, Reference, and Clarification Model

Status: **ACCEPTED PRODUCT SPECIFICATION**

## Findings

Primary fields: title, category, severity, observation, document location.
Advanced fields: blocking status, risk/impact, recommendation, owner, linked
references, and follow-up suggestion. System metadata: ID, source, creator,
timestamps, disposition, and history.

Official HUMAN_ONLY findings use source `HUMAN`. Future `AI_CANDIDATE` entries
must be human-reviewed through `PENDING_REVIEW → ACCEPTED | MODIFIED |
REJECTED`; an AI candidate never becomes official without that decision.

Categories: `REGULATORY_MISMATCH`, `INTERNAL_POLICY_CONFLICT`, `PROCESS_GAP`,
`CONTROL_WEAKNESS`, `AMBIGUOUS_WORDING`,
`DUPLICATE_OR_INCONSISTENT_RULE`, `ROLE_AND_RESPONSIBILITY_ISSUE`,
`AUDIT_OR_FRAUD_RISK`, `DOCUMENT_QUALITY`, and `OTHER` (explanation required).

Severity: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `OBSERVATION`. Default blocking
is true for Critical/High and false otherwise. Severity and blocking remain
separate: Critical/High made non-blocking or Medium made blocking requires a
reason and recorded history.

Statuses are `OPEN`, `WAITING_FOR_CLARIFICATION`, `RESOLVED`, `DEFERRED`, and
`DISMISSED`. Dismissal never hard-deletes. Resolved requires type, summary,
actor, timestamp, and related draft/version where supported. Resolution types:
`DOCUMENT_UPDATED`, `CLARIFICATION_ACCEPTED`, `CONTROL_CONFIRMED`,
`NO_CHANGE_REQUIRED`, `OTHER`. Deferred requires reason, owner, target
date/milestone, and risk acknowledgement; dismissed requires a reason.

## Evidence

Evidence is an individual structured item: `DOCUMENT_EXCERPT`,
`REFERENCE_SOURCE`, `CLARIFICATION_RESPONSE`, `SUPPORTING_ATTACHMENT`, or
`REVIEWER_NOTE`. It supports type, title/description, excerpt/summary, source,
document location, secure attachment/reference, actor, and timestamp. The
default UI shows count/summary; full content is drawer-only.

## Reference Set

The Reference Set belongs to a Refinement session and references can link to
individual findings. Types: `EXTERNAL_REGULATION`, `INTERNAL_POLICY`,
`BEST_PRACTICE`, `AUDIT_FINDING`, `BUSINESS_REQUIREMENT`,
`FRAUD_RISK_INSIGHT`, `SPENDING_ANALYSIS`, `SUPPORTING_DOCUMENT`. Each has type,
title, source organization, effective date, identifier/version, secure link or
file, relevance note, active state, linked findings, actor, and timestamp.
Removing from the active set preserves historical evidence. Completion requires
at least one active reference.

## Clarification and follow-up

Clarification is linked to one finding: question, requester, requested BU,
optional due date, response, supporting evidence, status, response and closure
timestamps. Status is `OPEN`, `RESPONDED`, or `CLOSED`.

`OPEN finding → request clarification → WAITING_FOR_CLARIFICATION → BU response
→ Tim Procurement review → resolve/reopen/keep open`.

The only M3 follow-up affordance is optional: requires follow-up action,
suggested owner, target date, and note. It must reconcile with the existing
`ActionItem` model; M3 does not invent a second action-item system.
