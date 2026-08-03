# Product

## Purpose

Procurement Governance Hub supports controlled SOP governance across Business
Units. It stores SOP documents and versions, captures requested changes,
supports human refinement findings, schedules audit appointments, and presents
engagement and operational information.

The approved product interface is the application at `/`.

## Users and roles

| Role | Product use |
| --- | --- |
| Superuser | Administers users and master data, and can manage governance work across Business Units. |
| Tim Procurement | Manages SOP governance, submissions, refinement, document controls, and audit activities across Business Units. |
| Business Unit | Works with documents and submissions in its assigned Business Unit scope; responds to assigned clarification and audit activity. |
| Executive | Has cross-Business-Unit read access to governance, audit, and reporting information; does not have mutation access in governance APIs. |

The application uses the database role values `SUPER_USER`,
`CORPORATE_GOVERNANCE`, `BUSINESS_UNIT_PIC`, and `EXECUTIVE` for those
four roles respectively.

## Menus

| Menu | Function |
| --- | --- |
| Home | Landing dashboard and links to operational information. |
| Submissions | Business Unit change submissions, review status, messages, and notifications. |
| Repository | SOP library, document compliance, filters, document versions, upload, update, approval, and master data. |
| Refinement | Human-only refinement queue and workspace for SOP versions that require structured review. |
| Calendar | Online, onsite, or hybrid audit appointments with selected PICs or all Business Units. |
| Engagement | Business Unit engagement index and indicator detail. |
| Insights | Reporting and operational insight views. |
| People | Struktur organisasi per Business Unit serta profil personel dan penempatan jabatan. |
| Directory | User and PIC directory. User creation and password reset are restricted to Superuser. |

Menu availability and permitted actions are determined by the authenticated
user's role and Business Unit scope.

## Document controls

SOPs belong to a Business Unit and may be classified by group, industry,
category, document type, owner, and version. The repository supports mandatory
and additional document types, so compliance can show documents that are
present, in draft, or missing.

The mandatory compliance order is M1 Procurement Policy, M2 Procurement SOP,
M3 Supplier Info & Performance Mgmt SOP, M4 Matrix Level Authorization, M5
Ethic Policy, and M6 Code of Conduct.

Files are stored privately. The application supports PDF/DOCX upload through
the document API, secure download, and inline access where the file type and
storage provider support it.

Draft uploads in the Repository store the uploader, assigned reviewer, and
approval record. A draft can be previewed or downloaded before approval, and
only the assigned reviewer can approve it.

## People and organization structure

People uses the existing Business Unit master as its primary boundary; it does
not introduce a second Business Unit directory. The module has **Struktur
Organisasi** and **Profil Personel** views. A structure is made of positions,
not people: a position may be vacant or have one or more current occupants.

Superuser and Tim Procurement can maintain organization structures, positions,
and reusable person profiles. A profile records core identity, formal education,
and certifications; it can be archived only after its active assignments end.
One or more active people can occupy a position as permanent or acting staff.
Ending an assignment preserves its dated history, while an unoccupied position
remains visible as vacant.
Business Unit users can view only records within their effective Business Unit
scope. Executive has no People access unless an explicit People permission is
added in a later product decision.

People provides a read-only experience for Business Unit users: the interface
does not expose structure, profile, or assignment mutation controls, and the
server rejects those operations. Within their permitted scope, they can search
the chart and open position and profile details. Personal contact details,
certification credential IDs, and certification evidence links are withheld
from Business Unit responses; education, certification names, and scoped
assignment information remain available for operational context.

Person profiles are separate from user accounts so employees without an
application login, or with more than one assignment, can be represented. A
profile supports education, certifications, and historical assignments.
Position tenure is calculated from assignment start and end dates. Historical
records are archived or end-dated rather than hard-deleted.
