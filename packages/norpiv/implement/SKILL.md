---
name: implement
description: Implement the next approved vertical slice from the active WORK.md and prepare a Draft PR/MR. Use when the plan is approved and the user explicitly asks to implement.
---

# Skill: implement

Execute one functional vertical slice and hand it to the human for review.

## Guardrails
- READ: `.workflow/active_task.json` then active `WORK.md` `[PLAN]`.
- WRITE: code changes and `WORK.md` -> append to `[LOG]` only.
- NEVER: edit `[BRIEF]` or `[GRILL]`.
- NEVER: implement without explicit user instruction.
- NEVER: add `Signed-off-by`; only the human can certify DCO.

## Workflow
1. Identify the first approved unchecked slice in `[PLAN]`.
2. Move tracked task to **In Progress** only when implementation actually starts.
3. **Mandatory Branch Check**: You MUST run the branch enforcement script before modifying any code.
   - Use the absolute path if possible: `<skill_location>/scripts/enforce-branch.sh`.
   - This script prevents accidental implementation on `main`/`master`.
   - If the script switches branches, you must update the `[META]` section of `WORK.md` to reflect the new branch name.
   - If the script fails, STOP and ask the human for help. Do not proceed with code changes.
4. Implement test-first where practical; otherwise document why not in `[LOG]`.
5. Run the slice verification command and available quality gates.
6. Commit with Conventional Commit header and `Assisted-by: [AGENT]:[MODEL] [tools]` footer (populating the agent name and model ID from the current session context).
7. Push and open a Draft PR/MR with `gh` or `glab` when a remote exists.
8. Append summary, commit hash, and PR/MR link to `[LOG]` (Format: `YYYY-MM-DD hh:mm AM/PM`).

## Output contract
End with:
- **Slice implemented**
- **Verification run**
- **Commit**
- **Draft PR/MR**
- **Human review required**
