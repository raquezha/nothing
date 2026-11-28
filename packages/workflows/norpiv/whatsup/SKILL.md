---
name: whatsup
description: >
  Rehydrate task context and instant orientation. Triggered by: /whatsup, /status,
  "what's up", "what happened", "where are we", "where were we", "what is next", "what's next".
  Use when returning to coding, after a break, or when switching tasks to know where we are,
  what just finished, what is in-flight, and the exact next single action.
---

# Skill: whatsup

Instant 10-second rehydration of workflow status, branch context, and immediate next step.

## Guardrails
- READ: `.workflow/active.json`, active `WORK.md` (`[META]`, `[BRIEF]`, `[PLAN]`, `[LOG]`), and git status (`git branch --show-current`, `git status -s`).
- WRITE: None. STRICTLY read-only.
- NEVER: mutate code, write files, transition trackers, or run destructive git commands.
- OUTPUT FORMAT: Exactly 4 concise bullets. No fluff, no transcript regurgitation.

## Workflow
1. Read `.workflow/active.json`.
   - If missing or no active task: report that no task is active and suggest `/triage <source>:<id>` or `/pulse`.
2. Read the active task's `WORK.md`:
   - Parse `[META]` (branch, status, phase).
   - Parse `[BRIEF]` (task type, source id, core objective).
   - Parse `[PLAN]` (find checked slices vs first unchecked slice).
   - Parse `[LOG]` (find the most recent 1-2 completed actions/commits).
3. Check Git State:
   - Run `git branch --show-current` (verify against `WORK.md` `[META]`).
   - Run `git status -s` (note if there are uncommitted changes).
4. Output the 4-bullet re-orientation.

## Output Contract
Output exactly:
- **Where we are**: `[source:id]` (`<classification/title>`) on `<branch>` • Phase: `<phase>`
- **What just happened**: `<last completed action/slice from [LOG] with timestamp/commit>`
- **In-flight**: `<current unchecked slice from [PLAN] or uncommitted changes>`
- **Next single action**: `<exact next command to run, e.g. /implement, /verify, /plan, /sync>`
