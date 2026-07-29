# CP2A Local Migration Review Report

Generated against the local PostgreSQL database after the CP2A schema migration on 29 July 2026. This report is informational only; it does not change lifecycle state or publication status.

## Review rule

- Legacy `DRAFT` maps to lifecycle `DRAFT`.
- Legacy `PUBLISHED` maps to lifecycle `PUBLISHED`; `publishedVersionId` is set only when the document has a matching current version.
- Legacy `ARCHIVED` maps to lifecycle `ARCHIVED`.
- Legacy `APPROVED` remains lifecycle `APPROVED`; it is never promoted automatically to `PUBLISHED`.
- Legacy `IN_REVIEW` is left at the safe default lifecycle `DRAFT` pending Tim Procurement classification as `REFINEMENT` or `VALIDATION`.

## Ambiguous records requiring manual review

| SOP ID | SOP title | Business Unit | Version ID | Version | Legacy document status | Proposed lifecycle | Publication evidence | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `cmrsutdtg0007pc3gffqmsn6c` | Code of Conduct — BAHANA | BAHANA | `cmrsutduf0009pc3gfsnf1gjv` | v1.0 | APPROVED | APPROVED | None | Confirm publication evidence before publishing. |
| `cmrsutdtg0007pc3gffqmsn6c` | Code of Conduct — BAHANA | BAHANA | `cmrsvxfqa0001ml3glfbg49a5` | v1.1 | APPROVED | APPROVED | None | Confirm publication evidence before publishing. |
| `cmrwee8jh0001mp3glw9a6lyr` | SOP procurement policy | BKES | `cmrwerrjn0002s03g4ow6efja` | v1.1 | APPROVED | APPROVED | None | Confirm publication evidence before publishing. |

There were no local records with legacy `IN_REVIEW`, `PUBLISHED`, or `ARCHIVED` at report generation time.

## Required follow-up in CP2B or an approved data-review activity

Tim Procurement or Superuser must explicitly record publication evidence before any listed `APPROVED` version becomes `PUBLISHED`. This CP2A migration intentionally does not make that decision.
