# Neon Prisma Baseline Plan

This plan is documentation only. Do not run `prisma migrate deploy` against current production yet. Production must never be reset.

The actual baseline path is selected only after comparing the production schema with the historical migration end-state. A Neon branch cloned from production must be used for every rehearsal. Rollback uses a Neon branch restore/backup or a forward-fix strategy; do not improvise a destructive down migration in production.

## Path A — Existing migration chain is verifiably equivalent

Use only when production exactly matches the final schema produced by all historical migrations before CP2A.

1. Create a Neon branch from production.
2. Back up or otherwise preserve that branch state.
3. Inspect the actual production schema on the branch.
4. Compare it with the historical migration end-state.
5. Confirm Prisma diff did not omit unsupported schema objects.
6. Mark verified historical migrations as applied on the Neon branch using Prisma baseline/resolve procedures.
7. Apply CP2A and CP2A.1 on the branch.
8. Verify schema diff and application regression.
9. Only then prepare a controlled production rollout.

## Path B — Existing migration chain is not equivalent

Use when historical migrations do not reproduce the exact production schema.

1. Create a Neon branch from production.
2. Introspect the exact production schema.
3. Generate a clean baseline migration representing the production schema before CP2A.
4. Review every generated SQL statement.
5. Add unsupported database objects manually where required.
6. Mark the baseline as applied on the Neon branch.
7. Recreate or retain CP2A and CP2A.1 as post-baseline migrations.
8. Apply and validate them on the Neon branch.
9. Only then prepare a controlled production rollout.
