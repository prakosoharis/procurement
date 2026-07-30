# M2-C5-T1 — Native Request Discussion

Status: DONE

## Scope

- Add `POST /api/governance/requests/[requestId]/messages`.
- Preserve legacy request messages and statuses as the business record.
- Render native chronological discussion history and a response form.
- Keep closed requests read-only and Executive users non-mutating.

## Verification

- `node --test test/request-discussion-contract.test.mjs`
- `npm run build`
- `git diff --check`
