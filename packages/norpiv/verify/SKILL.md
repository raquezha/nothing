---
name: verify
description: Verify the active slice or task against WORK.md, quality gates, and review readiness. Use after implementation or manual changes to decide whether work is ready for sync, review, or cleanup.
---

# Skill: verify

The final gate for a slice or task. Verify truth before reporting progress.

## Guardrails
- READ: `.workflow/active_task.json`, active `WORK.md` `[BRIEF]`, `[PLAN]`, and `[LOG]`.
- WRITE: `WORK.md` -> `[PLAN]` checkboxes and append to `[LOG]` only.
- NEVER: add `Signed-off-by`; tell the human to sign if needed.
- NEVER: transition tracker state if verification fails.
- NEVER: delete `.workflow` task folders without explicit user approval.

## Workflow
1. Compare code changes against `[BRIEF]` and the current `[PLAN]` slice.
2. Run stated verification commands and available quality gates.
3. Check for AI artifacts: placeholder comments, fake APIs, dead code, inconsistent naming.
4. Confirm commit messages include Conventional Commit format and `Assisted-by: [AGENT]:[MODEL] [tools]` when AI contributed.
5. If passing, mark the slice checkbox complete in `[PLAN]` and append verification evidence to `[LOG]` (Format: `YYYY-MM-DD hh:mm AM/PM`).
6. Recommend `/sync` for tracker update, or cleanup if the task is fully merged and user approves.

## Output contract
End with:
- **Objective met**: yes/no
- **Verification used**
- **Slice status**
- **Tracker sync needed**: yes/no
- **Next step**
