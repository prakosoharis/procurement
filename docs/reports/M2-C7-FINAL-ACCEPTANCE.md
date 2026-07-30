# M2 Final Acceptance Evidence

Status: ACCEPTED

Date: 2026-07-30

## Scope accepted

M2 delivers the native SOP Submission workflow without replacing the existing
legacy request evidence path:

- native list, intake, detail/review, and chronological discussion;
- server-authorized discussion, notifications, and audit evidence;
- transactional, idempotent conversion of an approved Submission into either a
  new SOP draft or a revision sourced from the official published version;
- capability-gated native conversion controls.

## Validation evidence

The following commands completed successfully on branch `staging` on
2026-07-30:

| Command | Result |
| --- | --- |
| `node --test test/*.test.mjs` | 56 passed, 0 failed |
| `npx prisma validate` | passed |
| `npx prisma generate` | passed |
| `npm run build` | passed |
| `git diff --check` | passed |

The focused suite includes request-discussion authorization/notification tests,
Submission conversion service and race/idempotency tests, conversion API
allowlist/capability tests, and native conversion visibility tests.

## Legacy compatibility verification

The production build contains both the established legacy request endpoints
under `/api/requests/*` and the native governance endpoints under
`/api/governance/requests/*`. No legacy request route was removed or redirected
as part of M2. Existing `SopRequest`, `RequestMessage`, notification, and audit
records remain the source of historical workflow evidence.

## User acceptance

The user explicitly authorized execution of M2 final acceptance in this
conversation on 2026-07-30 by replying **“kerjakan!”** after the final
acceptance checkpoint and its requirements were presented.

## Known limitations retained

- The local Docker database is schema-synchronized with `prisma db push` and
  is not historically baseline-managed by `_prisma_migrations`.
- The committed `20260730010000_add_submission_conversion` migration must be
  applied through the normal deployment process in migration-managed staging or
  production databases.
- Request notifications are in-app only; M2 introduces no email or external
  delivery channel.
