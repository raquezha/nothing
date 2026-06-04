---
name: frame
description: Define the task brief inside the active WORK.md. Use after /triage to convert issue data into a clear Problem or Proposal brief without creating separate PROBLEM.md or PRD.md files.
---

# Skill: frame

Turn raw task context into the stable "what/why" brief.

## Guardrails
- READ: `.workflow/active_task.json` then `.workflow/tasks/[active_task]/WORK.md`.
- WRITE: `WORK.md` -> `[BRIEF]` section and append to `[LOG]` only.
- NEVER: create `PROBLEM.md`, `PRD.md`, or extra planning files.
- NEVER: overwrite `[PLAN]` or `[GRILL]`.
- NEVER: ask whether to frame if the user invoked `/frame`; do it.

## Workflow
1. Read the active task and remote metadata.
2. Determine brief type:
   - **Problem** for bugs, regressions, crashes, broken behavior.
   - **Proposal** for features, enhancements, refactors, new behavior.
3. Create or replace only the `[BRIEF]` section with:
   - type and source id
   - current understanding
   - desired outcome
   - constraints / non-goals
   - acceptance hints if available
4. Keep the brief concise and reviewable.
5. **Log Activity**: Append a timestamped summary of the framing/re-framing to `[LOG]` (Format: `YYYY-MM-DD hh:mm AM/PM`). Include why the change was made if it is a pivot.
6. End by recommending `/grill-with-docs`.

## Output contract
End with:
- **Brief type**: Problem / Proposal
- **Updated section**: `[BRIEF]`
- **Open questions**: only if blocking
- **Next step**: `/grill-with-docs`
