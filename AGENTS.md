# Repository guidance

Read `README.md` and the documentation in `docs/` before changing the
application. Those documents describe the supported product and technical
contracts.

- Inspect `git status`, `git diff`, and relevant source files before editing.
- Preserve approved user-facing behaviour unless a change is explicitly
  requested.
- Keep authentication, authorization, Business Unit scope checks, audit records,
  and private document access server-side.
- Make focused changes, add or update relevant tests, run the appropriate
  validation commands, and commit a coherent change.
- Never expose credentials, tokens, database URLs, or private storage keys.
- Do not run destructive database commands, push, deploy, or modify production
  services unless explicitly authorized.

Use the product interface at `/` as the reference for user-facing menus and
visual behaviour. Do not replace or redesign it without explicit approval.
