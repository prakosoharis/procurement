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
- **AuditLog** records user and governance activity.
- **StorageIntegration** stores the connected Google Drive folder and encrypted
  refresh token.

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

## Document storage path

For Google Drive, an administrator authorizes the application through OAuth.
The application creates a `Procurement Governance Hub` folder, encrypts the
refresh token before storing it in PostgreSQL, and stores Drive file IDs as
`gdrive:<id>` keys.

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
