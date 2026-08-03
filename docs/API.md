# API Reference

All API routes are relative to the application origin. With the exception of
`POST /api/auth/login`, API access requires an authenticated session cookie.
Most routes return JSON. Document creation and version upload accept
`multipart/form-data`.

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
| GET, POST | `/api/documents` | List scoped documents or upload an initial SOP document. |
| POST | `/api/documents/:id/versions` | Upload an SOP version. |
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
| GET | `/api/people/options` | Scoped People Business Unit selector and server-derived view/manage capabilities. |
| GET | `/api/people/structure?businessUnitId=:id` | Scoped compact organization tree, current occupants, vacancy state, and capabilities. |
| POST | `/api/people/structures` | Create one active Business Unit structure and its root position atomically. |
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
to Superuser and Tim Procurement.
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

## Integrations

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/integrations/google-drive/connect` | Start Google Drive OAuth connection. |
| GET | `/api/integrations/google-drive/callback` | Complete Google OAuth callback and save the encrypted connection. |
