---
name: verify
workflow: rpiv
workflowPhase: verify
description: Verify the active slice or task against WORK.md, quality gates, and review readiness. Use after implementation or manual changes to decide whether work is ready for sync, review, or post-merge-prune.
---

# Skill: verify

The final gate for a slice or task. Verify truth before reporting progress.

## Guardrails
- READ: `.workflow/active.json` first, then compatibility `.workflow/active_task.json` only if needed, plus active `WORK.md` `[BRIEF]`, `[PLAN]`, and `[LOG]`.
- WRITE: `WORK.md` -> `[PLAN]` checkboxes and append to `[LOG]` only.
- NEVER: add `Signed-off-by`; tell the human to sign if needed.
- NEVER: transition tracker state if verification fails.
- NEVER: delete `.workflow` task folders without explicit user approval.

## Workflow
1. Compare code changes against `[BRIEF]` and the current `[PLAN]` slice.
2. Run stated verification commands and available quality gates.
3. If RepoScry is available, optionally add graph-aware evidence with commands such as `reposcry validate main HEAD` and `reposcry --repo . get_affected_flows main HEAD`. Treat RepoScry as supplemental evidence, not a hard requirement. Verify `.reposcry/` is not staged or tracked before reporting review readiness.
4. Check for AI artifacts: placeholder comments, fake APIs, dead code, inconsistent naming.
5. Confirm commits and PR/MR metadata satisfy the repository's own hooks, CI, and release policies. Do not invent or enforce extra RPIV-specific formatting here.
6. If passing, mark the slice checkbox complete in `[PLAN]` and append verification evidence to `[LOG]` (Format: `YYYY-MM-DD hh:mm AM/PM`).
7. Recommend `/sync` for tracker update, or `/post-merge-prune` if the task is fully merged and user approves.

## Output contract
End with:
- **Objective met**: yes/no
- **Verification used**
- **Slice status**
- **Tracker sync needed**: yes/no
- **Next step**
