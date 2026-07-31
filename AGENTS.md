# Execution workflow

Read `docs/MASTER-EXECUTION.md`, `docs/PROJECT-PLAN.json`, `docs/IMPLEMENTATION-STATUS.md`, and the active checkpoint before coding. Inspect git status/diff/history. User approval of a checkpoint authorizes every task inside that checkpoint: execute them sequentially, preserve prior work, test and commit coherent slices, then update plan, status, task evidence, and checkpoint progress. Do not request confirmation between tasks in an approved checkpoint.

Use `DECISION_REQUIRED` for unclear business behavior. Never mark milestones ACCEPTED without explicit user approval. Ask for approval only before beginning a new checkpoint, when a checkpoint contains an unresolved material business decision, or for a destructive-data, security, missing-schema, or repository-corruption blocker. Never push, deploy, or modify Neon without authorization. Never send progress-only responses.

Patch failure caused by formatting or changed source structure is not a blocker. The agent must inspect the current file and adapt the implementation using safe full-file editing or refactoring.
