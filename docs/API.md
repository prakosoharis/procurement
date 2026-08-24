# API Reference

All API routes are relative to the application origin. With the exception of
`POST /api/auth/login`, API access requires an authenticated session cookie.
Most routes return JSON. Repository SOP files use a private Vercel Blob upload
session and asynchronous Google Drive transfer, so file bytes do not pass
through a Vercel Function.

Governance routes under `/api/governance/*` use the error shape:

```json
{
  "ok": false,
  "error": { "code": "FORBIDDEN", "message": "…", "details": null },
  "meta": { "requestId": "…" }
}
```

Their successful responses include `ok: true`, `data`, and request metadata
where applicable.

## Authentication

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | Authenticate with email and password; creates an HTTP-only session cookie. |
| POST | `/api/auth/logout` | Clears the session cookie. |

## Approved product-interface APIs

| Method | Route | Purpose |
| --- | --- | --- |
| GET, POST | `/api/documents` | List scoped documents or legacy multipart upload of an initial SOP document. |
| POST | `/api/documents/:id/versions` | Legacy multipart upload of an SOP version. |
| POST | `/api/documents/direct-upload-sessions` | Validate initial SOP metadata and create a one-hour, single-file Vercel Blob upload session. A Business Unit may create several documents under one type when each uses a distinct title. |
| POST | `/api/documents/:id/direct-upload-sessions` | Validate revision metadata and create a one-hour, single-file Vercel Blob upload session. |
| POST | `/api/documents/direct-upload-sessions/:sessionId/complete` | Verify the private Blob object and queue the Google Drive transfer. Returns `202`; it does not create a draft immediately. |
| GET | `/api/documents/direct-upload-sessions/:sessionId` | Return the creator-scoped transfer status. `COMPLETED` includes the resulting draft/version metadata. |
| POST | `/api/documents/:id/approve` | Approve an SOP document/version. |
| GET | `/api/repository-overview` | Repository and document-compliance data. |
| GET | `/api/files/download` | Secure file download or inline file response. |
| GET, POST | `/api/requests` | List or create submissions. |
| GET, PATCH | `/api/requests/:id` | Read or manage a submission. |
| GET, POST | `/api/requests/:id/messages` | Read or add submission messages. |
| POST | `/api/requests/notifications/:id/read` | Mark an in-app submission notification read. |
| GET, POST | `/api/audit-events` | List or create audit appointments. |
| POST | `/api/audit-events/:id/participation` | Update an appointment participation response. |
| GET | `/api/engagement` | Engagement index and Business Unit indicator detail. |
| GET, POST | `/api/users` | Superuser user listing and creation. |
| POST | `/api/users/:id/password` | Superuser password reset. |
| GET | `/api/pics` | PIC data for selectors. |
| GET | `/api/business-units` | Business Unit data. |
| GET, POST | `/api/document-types` | Document-type data and management. |
| GET, POST, PATCH | `/api/master-data` | Repository master data; `PATCH` updates an existing Business Unit's Group and Industry. |
| GET | `/api/people/options` | Scoped People Business Unit and Group selectors plus server-derived view/manage capabilities. |
| GET | `/api/people/structure?scopeType=BUSINESS_UNIT|GROUP&scopeId=:id` | Scoped compact organization tree, current occupants, vacancy state, and capabilities. `businessUnitId` remains accepted for a Business Unit request. |
| POST | `/api/people/structures` | Create one active Business Unit or Group structure and its root position atomically. |
| POST | `/api/people/positions` | Create a child position in an active structure. |
| PATCH | `/api/people/positions/:positionId` | Named `update`, `move`, or `archive` position operation with `expectedUpdatedAt`. |
| GET, POST | `/api/people/profiles` | Scoped profile search and controlled profile creation. |
| GET, PATCH | `/api/people/profiles/:personId` | Scoped profile detail and named `update` or `archive` operation. |
| POST | `/api/people/assignments` | Create a dated `PERMANENT` or `ACTING` assignment for an active person and position. |
| POST | `/api/people/assignments/:assignmentId/end` | End-date an assignment with optimistic concurrency, preserving history. |
| GET | `/api/people/positions/:positionId/history` | Scoped current and historical position assignments. |

People profile list and detail responses are scoped by the authenticated
user's effective Business Unit set. For Business Unit viewers, `email`,
`phone`, `photoUrl`, certification `credentialId`, and certification
`evidenceUrl` are returned as `null`; mutation routes remain server-restricted
to Superuser and Tim Procurement. Profile DTOs include `firstWorkStartedAt`
and a server-derived `totalWorkExperience`; callers send the first-work date,
never a manually calculated total.
| GET, POST | `/api/references` | Reference-source data. |
| GET, POST | `/api/findings` | Legacy finding data. |
| GET, PATCH | `/api/findings/:id` | Read or update a legacy finding. |

## Governance SOP and submission APIs

| Method | Route | Purpose |
| --- | --- | --- |
| GET, POST | `/api/governance/sops` | Scoped SOP list and metadata-first draft creation. |
| GET | `/api/governance/sops/:sopId` | SOP detail, version data, and server-derived capabilities. |
| GET | `/api/governance/sops/:sopId/activity` | SOP activity history. |
| POST | `/api/governance/sops/:sopId/revisions` | Create a draft revision from the official published version. |
| PATCH | `/api/governance/versions/:versionId` | Edit allowlisted draft metadata with optimistic-concurrency fields. |
| POST | `/api/governance/versions/:versionId/submit` | Submit a draft. |
| POST | `/api/governance/versions/:versionId/refinement/start` | Start Human-Only Refinement. |
| POST | `/api/governance/versions/:versionId/refinement/complete-human` | Complete ready refinement and move to validation. |
| GET, POST | `/api/governance/requests` | Scoped submission list and intake. |
| GET | `/api/governance/requests/:requestId` | Submission detail and capabilities. |
| POST | `/api/governance/requests/:requestId/messages` | Add a submission message. |
| POST | `/api/governance/requests/:requestId/conversion` | Convert an approved submission to a controlled draft or revision. |
| GET | `/api/governance/options` | Scoped form options. |

## Refinement APIs

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/governance/refinement` | Scoped refinement queue. |
| GET | `/api/governance/refinement/:versionId` | Human-only workspace detail. |
| GET, POST | `/api/governance/refinement/:versionId/findings` | List or create human findings. |
| PATCH | `/api/governance/refinement/:versionId/findings/:findingId` | Edit a human finding. |
| POST | `/api/governance/refinement/:versionId/findings/:findingId/evidence` | Add evidence. |
| POST | `/api/governance/refinement/:versionId/findings/:findingId/clarifications` | Request a Business Unit clarification. |
| POST | `/api/governance/refinement/:versionId/findings/:findingId/disposition` | Resolve, defer, or dismiss a finding. |
| GET | `/api/governance/refinement/:versionId/references` | Read selected references. |
| GET | `/api/governance/refinement/:versionId/history` | Read refinement history. |
| GET | `/api/governance/refinement/:versionId/readiness` | Read server-derived completion readiness. |
| PATCH | `/api/governance/refinement/:versionId/summary` | Save refinement summary with concurrency checking. |
| POST | `/api/governance/refinement/clarifications/:clarificationId/respond` | Submit an assigned Business Unit clarification response. |
| POST | `/api/governance/refinement/clarifications/:clarificationId/close` | Close a responded clarification. |

## AI

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/ai/chat` | Ask the Procurement Governance Hub assistant a question. Returns `answer`, `dataAvailable`, `references`, `inScope`, `topics`, and `conversationId`. |
| GET | `/api/ai/chat/conversations` | List the caller's own chatbot conversation threads. `?userId=` is honoured only for actors with `ACTIVITY_LOG_VIEW`; otherwise it is ignored and the caller's own conversations are returned. |
| GET | `/api/ai/chat/conversations/:conversationId` | One conversation's transcript with every message. Requires ownership or `ACTIVITY_LOG_VIEW`; otherwise `404`, so a conversation's existence is not disclosed either. |
| GET | `/api/ai/health` | Superuser-only AI runtime check. Makes one small provider request and returns provider, model, latency, and feature-flag state. Returns `503` when the provider is unconfigured or unreachable. |

Responses carry `mode`: `AI` for a provider answer, `DATA_SUMMARY` for a
deterministic answer built from records without a provider call, and
`OUT_OF_SCOPE` for a refused question. An interface must label a `DATA_SUMMARY`
answer as such rather than present it as AI analysis.

`POST /api/ai/chat` accepts `{ "question": string, "history": [{ "role": "user"|"assistant", "content": string }] }`.
The question is limited to 2,000 characters and history to the six most recent
turns of 1,000 characters each; a caller-supplied `system` turn is discarded
rather than forwarded. Requests are rate limited per user.

The route runs authentication, authorization, rate limiting, deterministic scope
classification, and scoped retrieval **before** any provider call. An
out-of-scope question is answered deterministically, is recorded as an
`AiEvent` with `BLOCKED_SCOPE`, and never reaches the model. Retrieved context
is restricted to the caller's effective Business Unit scope, follows the
stricter calendar rule for audit appointments, and never contains personal
contact data, certification credential IDs, or evidence links.

The assembled context states how many records were found, how many were omitted
for size, and which topics failed to load, so a genuine zero result is reported
as zero rather than as missing data.

Every citation the model returns is verified against the records that were
actually retrieved (`lib/ai/chat/grounding.js`) before the response leaves the
server -- the output schema only constrains a reference's shape, not that it
points at something real. A reference whose `recordId` (or, failing that,
`label`) does not match a retrieved record is dropped. If `dataAvailable: true`
is claimed with zero traceable citations remaining, the whole answer is
replaced with an honest "cannot be confirmed" response and `dataAvailable` is
forced to `false`; the event is recorded as `AiEvent.INVALID_OUTPUT` with
reason `UNGROUNDED_ANSWER`. An honest `dataAvailable: false` answer is never
altered by this check.

The response never contains a credential, a raw provider payload, or a prompt.
Provider failures are reported as a fixed code (`AI_NOT_CONFIGURED`,
`AI_AUTHENTICATION_FAILED`, `AI_RATE_LIMITED`, `AI_TIMEOUT`,
`AI_INVALID_OUTPUT`, `AI_PROVIDER_UNAVAILABLE`, `AI_DISABLED`) with a safe
message; the underlying provider error is logged server-side only.

Every exchange is written to `AiChatConversation`/`AiChatMessage` -- the
literal question and answer text, capped at 4,000 characters, plus `mode`,
`dataAvailable`, `inScope`, `topics`, and `references`. This is a UAT-quality
and audit log distinct from `AiUsage`, which is the metered-cost record and
never holds conversation text. Every mode is recorded, including a rejected
out-of-scope question and an answer downgraded by the grounding check, so the
transcript reflects exactly what the caller received. The write is
best-effort: a transcript failure never changes or blocks the answer returned
to the caller.

The server assigns `conversationId` on a thread's first turn if the caller does
not supply one; resending the same id on later turns appends to the same
conversation. Retention is operational, not automatic -- see
`scripts/purge-chat-transcripts.js` in the Technical Guide.

## AI-assisted Refinement

`/hub/refinement` is a dedicated React page, not the static hub asset. Every
other hub page keeps rendering `procurement-governance-hub.html` in an iframe;
this is the one screen with genuinely new functionality -- starting an AI
analysis, reviewing candidate findings, recording a human decision -- that the
static asset has no equivalent for. Its Refinement tab remains demo markup and
was left untouched. `app/hub/[page]/page.js` no longer lists `'refinement'`:
Next.js gives a static route priority over a dynamic one at the same path, so
`app/hub/refinement/page.js` intercepts it regardless.

| Method | Route | Purpose |
| --- | --- | --- |
| GET, POST | `/api/governance/refinement/:versionId/ai-runs` | List analyses for a SOP version, or start one against approved reference sources. |
| GET | `/api/governance/refinement/:versionId/ai-runs/:runId` | Analysis status and its candidate findings. |
| POST | `/api/governance/refinement/ai-findings/:findingId/decision` | Record the human validation decision on one AI candidate finding. |

`POST` accepts `{ "sourceIds": [string] }` and is restricted to Superuser and
Tim Procurement within the SOP's Business Unit scope. Only approved reference
sources are accepted; an unapproved or unknown source is rejected. It returns
`202` for newly queued work and `200` when an identical analysis is reused or is
already running.

One analysis is one SOP version, one set of source versions, and one
analysis-method version. That combination is hashed into
`RefinementJob.fingerprint`, so an identical request reuses the completed result
instead of paying for the same analysis again, and a duplicate request joins the
run already in flight.

Analysis runs in the `refinement-analysis` Trigger.dev task, not in the request.
`RefinementJob.status` advances through `QUEUED`, `PREPARING`, `RETRIEVING`,
`ANALYZING`, and then `COMPLETED` or `FAILED`, so the UI polls real progress.
The stored provider error message is never returned; only its classified
`errorType` is.

Results are candidate findings written to `RefinementFinding` with
`humanStatus: PENDING`. They are input to human validation and never approve a
finding, edit the official SOP, or publish a version. MVP input scope is a
text-layer PDF; a DOCX or scanned PDF is rejected with a stated reason.

Run responses include `generatedOffline`. When it is `true` the analysis was
produced with Claude Code by a developer and imported, not produced by the
deployed application calling a provider. **An interface that renders a run must
display that distinction visibly.** Presenting an imported run as a live
application result would misrepresent it.

The decision route accepts `{ "decision", "comment", "metadata" }`. It is a thin
entry point onto the existing `decideRefinementFinding` service, which enforces
the reviewer role and Business Unit scope, requires a comment for
`REVISI`/`ABAIKAN`, writes the `ValidationDecision` record, and appends the
audit event. `decision` accepts the product vocabulary `VALID`, `REVISI`, and
`ABAIKAN`, mapped onto `ACCEPTED`, `ACCEPTED_WITH_MODIFICATION`, and `REJECTED`;
the raw `ValidationDecisionType` values remain accepted.

## Integrations

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/integrations/google-drive/connect` | Start Google Drive OAuth connection. |
| GET | `/api/integrations/google-drive/callback` | Complete Google OAuth callback and save the encrypted connection. |

### Large SOP upload

The Repository UI first sends only file metadata to an upload-session route.
The server checks the actor, Business Unit, PIC, assigned reviewer, file type,
and 25 MB application limit, then returns a time-bound URL scoped to one
private Vercel Blob pathname. The browser uploads the file directly to Blob.

The completion route verifies the Blob pathname, size, and MIME type and queues
the transfer worker. The worker streams the object into the resolved Google
Drive Business Unit folder, then creates the draft/version and AuditLog record
transactionally. The UI polls the status route until `COMPLETED`. Sessions are
tied to their creator; the browser never receives Google Drive credentials,
the Vercel Blob read-write token, or raw storage configuration.
