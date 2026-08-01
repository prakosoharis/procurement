# Architecture

## Components

| Component | Technology | Responsibility |
| --- | --- | --- |
| Web application | Next.js App Router and React | User interface, Route Handlers, session-aware server rendering. |
| Database | PostgreSQL with Prisma | Governance data, users, workflow records, audit logs, and storage integration configuration. |
| Local object storage | MinIO with S3-compatible API | Private document storage during Docker-based local development. |
| Optional document storage | Google Drive or S3-compatible storage | Private document upload and download outside the local MinIO setup. |

The main product interface is delivered as a static application asset inside the
Next.js application. Route Handlers provide data and mutations to that
interface. The app also contains governed server-rendered routes for SOP,
submission, and refinement operations; their authorization remains on the
server.

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

For S3-compatible storage, the application creates a private bucket when
needed and stores the object key with the SOP version. Downloads use a signed
URL or a streamed response.

For Google Drive, an administrator authorizes the application through OAuth.
The application creates a `Procurement Governance Hub` folder, encrypts the
refresh token before storing it in PostgreSQL, and stores Drive file IDs as
`gdrive:<id>` keys.
