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
| Directory | User and PIC directory. User creation and password reset are restricted to Superuser. |

Menu availability and permitted actions are determined by the authenticated
user's role and Business Unit scope.

## Document controls

SOPs belong to a Business Unit and may be classified by group, industry,
category, document type, owner, and version. The repository supports mandatory
and additional document types, so compliance can show documents that are
present, in draft, or missing.

Files are stored privately. The application supports PDF/DOCX upload through
the document API, secure download, and inline access where the file type and
storage provider support it.
