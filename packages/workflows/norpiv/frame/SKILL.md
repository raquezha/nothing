---
name: frame
workflow: rpiv
workflowPhase: frame
description: Define the task brief inside the active WORK.md. Use after /triage to convert issue data into a clear Problem or Proposal brief without creating separate PROBLEM.md or PRD.md files.
---

# Skill: frame

Turn raw task context into the stable "what/why" brief.

## Guardrails
- READ: `.workflow/active.json` first, then legacy compatibility `.workflow/active_task.json` only if needed, and active `WORK.md`.
- WRITE: `WORK.md` -> `[BRIEF]` section and append to `[LOG]` only.
- NEVER: create `PROBLEM.md`, `PRD.md`, or extra planning files.
- NEVER: overwrite `[PLAN]` or `[GRILL]`.
- NEVER: ask whether to frame if the user invoked `/frame`; do it.

## Workflow
1. Read the active task and remote metadata.
3. Determine brief type:
   - **Problem** for bugs, regressions, crashes, broken behavior.
   - **Proposal** for features, enhancements, refactors, new behavior.
4. Classify task evidence requirements:
   - **Evidence Category**: `UI-sensitive` (UI components, screens, layout), `Formula-sensitive` (math, rate tables, tier logic), or `Backend-safe` (pure backend, refactoring, infra).
   - **Evidence Status**: `present`, `missing`, or `n/a`.
   - **UI Evidence Rule**: `present` requires a direct Zeplin screen URL (`https://zpl.io/<id>` or `*.zeplin.io/.../screen/...`) or direct Figma screen/frame URL (`https://figma.com/design/...` with `node-id` / frame parameter) on the source ticket. Attachments, screenshots, generic project links, and links on parent/linked tickets do NOT satisfy `present` (parent links are logged as repair hints).
   - **Formula Evidence Rule**: `present` requires explicit formula spec, truth table, or exact logic definition on ticket.
   - **Backend-safe Exemption**: Evidence status is `n/a`.
5. Create or replace only the `[BRIEF]` section with:
   - type and source id
   - evidence classification (category and status)
   - current understanding
   - desired outcome
   - constraints / non-goals
   - acceptance hints if available
6. Keep the brief concise and reviewable.
7. **Log Activity**: Append a timestamped summary of the framing/re-framing to `[LOG]` (Format: `YYYY-MM-DD hh:mm AM/PM`). Include why the change was made if it is a pivot.
8. End by recommending `/grill-with-docs`.

## Output contract
End with:
- **Brief type**: Problem / Proposal
- **Updated section**: `[BRIEF]`
- **Open questions**: only if blocking
- **Next step**: `/grill-with-docs`
