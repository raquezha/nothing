---
name: verify
description: Verify the active slice or task against WORK.md, quality gates, and review readiness. Use after implementation or manual changes to decide whether work is ready for sync, review, or post-merge-prune.
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
3. If RepoScry is available, optionally add graph-aware evidence with commands such as `reposcry validate main HEAD` and `reposcry --repo . get_affected_flows main HEAD`. Treat RepoScry as supplemental evidence, not a hard requirement. Verify `.reposcry/` is not staged or tracked before reporting review readiness.
4. Check for AI artifacts: placeholder comments, fake APIs, dead code, inconsistent naming.
5. Confirm commit messages include Conventional Commit format. When AI contributed, you MUST append an `Assisted-by` trailer. Do NOT guess or hallucinate the model name from your system prompt. You must run `bash ~/RQZ/personal/nothing/packages/norpiv/scripts/get-pi-model.sh` and use its exact output to construct the trailer: `Assisted-by: <EXACT_OUTPUT> [tools]`.
6. If passing, mark the slice checkbox complete in `[PLAN]` and append verification evidence to `[LOG]` (Format: `YYYY-MM-DD hh:mm AM/PM`).
7. Recommend `/sync` for tracker update, or `/post-merge-prune` if the task is fully merged and user approves.

## Output contract
End with:
- **Objective met**: yes/no
- **Verification used**
- **Slice status**
- **Tracker sync needed**: yes/no
- **Next step**
