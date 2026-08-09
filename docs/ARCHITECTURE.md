# Architecture

## Components

| Component | Technology | Responsibility |
| --- | --- | --- |
| Web application | Next.js App Router and React | User interface, Route Handlers, session-aware server rendering. |
| Database | PostgreSQL with Prisma | Governance data, users, workflow records, audit logs, and storage integration configuration. |
| Document storage | Google Drive | Private SOP, source, attachment, and evidence-file storage. |

The main product interface is delivered as a static application asset inside the
Next.js application. Route Handlers provide data and mutations to that
interface. Product screens are served through `/` and `/hub/:page`; backend
authorization remains on the server through Route Handlers and shared services.

## Core data

- **BusinessUnit**, **OrganizationGroup**, **Industry**, and **SopCategory**
  hold organization and SOP classification data.
- **User** and **UserBusinessUnitScope** define a user's primary and additional
  Business Unit access.
- **SopDocument** owns SOP metadata and its official published version.
- **SopVersion** contains document-file metadata and lifecycle state.
- **SopRequest**, **RequestMessage**, **TicketNotification**, and
  **SubmissionConversion** support submission discussion and conversion.
- **RefinementSession**, **HumanRefinementFinding**,
  **HumanRefinementEvidence**, and **RefinementClarification** support
  human-only refinement.
- **AuditEvent** and **AuditEventParticipant** represent scheduled audit
  appointments and attendance.
- **OrganizationStructure** and **OrganizationPosition** represent one current
  hierarchy scoped to either a Business Unit or an Organization Group,
  including its root/child position relationship.
- **Person**, **PersonEducation**, **PersonCertification**, and
  **PositionAssignment** represent reusable personnel profiles, qualifications,
  and dated placement history separately from application user accounts.
- **AuditLog** records user and governance activity.
- **StorageIntegration** stores the connected Google Drive folder and encrypted
  refresh token. **GoogleDriveUploadSession** is a short-lived, server-owned
  record used to validate direct browser uploads before a SOP draft is created.

## Data access and scope

All database access uses Prisma. A Business Unit user's effective scope is the
union of:

1. `User.businessUnitId`; and
2. all `UserBusinessUnitScope.businessUnitId` records.

Duplicate IDs are removed. A Business Unit user with no effective scope fails
closed: scoped queries return no cross-Business-Unit data and direct
out-of-scope access is denied. Superuser, Tim Procurement, and Executive have
cross-Business-Unit access according to their permissions; Executive is
read-only for governance mutations.

People applies the same effective Business Unit scope before its database
queries are built. For a Group-scoped structure, a Business Unit user must have
at least one effective Business Unit belonging to that Group; the server checks
this with a scoped database query before loading the structure, positions, or
assignments. Its API returns only server-derived capabilities
(`canEditStructure`, `canManagePeople`, and `canManageAssignments`) and compact
Business Unit selector data; it does not return role/session data or raw scope
arrays. The People permission policy permits Superuser, Tim Procurement, and
Business Unit users to view; only Superuser and Tim Procurement can mutate.

For a Business Unit viewer, People profile DTOs preserve their stable fields but
set personal contact data, certification credential IDs, and evidence links to
`null`. The server applies this DTO sanitization after the scoped query; client
code never receives an elevated role or an unrestricted profile payload.
The `Person.firstWorkStartedAt` date is the source of truth for total work
experience; the total is calculated in the DTO rather than persisted.

## Document storage path

For Google Drive, an administrator authorizes the application through OAuth.
The application reuses a valid existing `Procurement Governance Hub` root when
Drive is reconnected; it creates one only when no valid root is stored. The
refresh token is encrypted before storing it in PostgreSQL, and Drive file IDs
are stored as `gdrive:<id>` keys.

### Google Drive directory convention

Google Drive is the document-storage authority. File IDs, rather than a Drive
path, remain the durable database reference so a file can be moved without
breaking preview or download access.

The connected root folder must follow this structure:

```text
Procurement Governance Hub/
├── SOP/
│   └── <Business Unit name>/
└── Sumber Pembanding/
    └── <Penerbit atau Regulator>/
        └── <Nomor regulasi>/
```

All SOP versions for one Business Unit must be placed in that Business Unit's
folder, for example `SOP/SMI/`. Source documents must first be grouped by their
publisher or regulator, for example `Sumber Pembanding/OJK/`; revisions of one
regulation are grouped in its regulation-number folder. Internal sources may
use additional categories below `Internal`, such as `Best Practice` and `Hasil
Audit`.

Folder lookup and creation must be idempotent. Existing application-owned files
are reorganized by changing their Drive parent only; their `gdrive:<id>`
database value must remain unchanged. The implementation must audit every move,
support a dry-run before a bulk migration, and never create public file links.

Each **BusinessUnit** records its resolved SOP folder ID after provisioning.
Creating a Business Unit through master data provisions `SOP/<Business Unit>/`
before the new BU is returned as successful. Every new SOP upload and version
upload resolves the same folder, so new files do not land in the Drive root.

### Direct browser-to-Drive uploads

Vercel Functions have a request-body limit that is smaller than the supported
SOP file limit. For Repository uploads, the server therefore never proxies file
bytes: it creates a resumable Google Drive upload session with the encrypted
OAuth connection, then the browser transfers file chunks directly to Google
Drive. Only the short-lived upload URL reaches the browser. Completion is
server-side and transactional: the Drive file metadata must match the session
and the draft/version plus its AuditLog entry are created together. This keeps
authorization, Business Unit placement, reviewer assignment, and durable
`gdrive:<id>` references under application control.
