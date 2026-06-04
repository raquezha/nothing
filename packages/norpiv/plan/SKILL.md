---
name: plan
description: Create or revise vertical implementation slices in the active WORK.md. Use after /grill-with-docs to produce a concise, reviewable plan for implementation.
---

# Skill: plan

Map the "how" into tracer-bullet vertical slices.

## Guardrails
- READ: `.workflow/active_task.json` then active `WORK.md` `[BRIEF]` and `[GRILL]`.
- WRITE: `WORK.md` -> `[PLAN]` and append to `[LOG]` only.
- NEVER: implement code during planning.
- NEVER: create standalone `PLAN.md`.
- NEVER: ask whether to plan if the user invoked `/plan`; produce the plan.

## Workflow
1. Read the brief and grill decisions.
2. **Branch Check**: Verify the current git branch. Planning on `main` is safe and encouraged. If you are on an unrelated feature branch, warn the human that the plan is being made on a stale or mismatched context.
3. Draft thin vertical slices that are independently verifiable.
4. Mark each slice:
   - **AFK**: agent can implement with clear checks.
   - **HITL**: human judgment, product decision, external access, or manual review required.
5. Include dependencies and verification command(s) per slice.
6. Write the plan into `[PLAN]` with checkboxes.
7. **Log Activity**: Append a timestamped entry to `[LOG]` summarizing the plan or revision (Format: `YYYY-MM-DD hh:mm AM/PM`).
8. Recommend `/sync` if the task has a tracker, then `/implement`.

## Output contract
End with:
- **Slices**: count and names
- **AFK/HITL split**
- **Verification commands**
- **Next step**: `/sync` or `/implement`
