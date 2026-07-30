# Repository execution workflow

`docs/MASTER-EXECUTION.md` is the architectural source of truth. Before coding, read it and `docs/IMPLEMENTATION-STATUS.md`, then inspect `git status`, `git diff`, and recent commits.

Continue the next unchecked item in the active phase. Preserve completed work, implement one coherent slice at a time, test it, commit it, and update `docs/IMPLEMENTATION-STATUS.md` after every commit.

Never claim a phase is complete while acceptance criteria remain unchecked. Do not send progress-only responses. Stop only for a proven destructive-data, security, missing-schema, or corrupted-repository blocker.

Never start the next phase without explicit approval. Never push, deploy, or modify Neon unless explicitly authorized.
