# M2-C5 — Native Request Discussion and History

Status: DONE

The native request detail now exposes the chronological `RequestMessage`
history and adds a governance API endpoint for new discussion messages.

## Acceptance evidence

- Business Unit actors can post only on requests they submitted.
- Superuser and Tim Procurement can post on request discussions across BUs.
- Executive is read-only and cannot post messages.
- Approved and rejected requests have read-only discussion history.
- New messages create recipient notifications and an `AuditLog` event.
- Native list items link to the native detail route.
