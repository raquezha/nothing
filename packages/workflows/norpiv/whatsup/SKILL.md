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
- READ: `.workflow/active.json` first, then compatibility `.workflow/active_task.json` only if needed, active `WORK.md` (`[META]`, `[BRIEF]`, `[PLAN]`, `[LOG]`), and git status (`git branch --show-current`, `git status -s`).
- WRITE: None. STRICTLY read-only.
- NEVER: mutate code, write files, transition trackers, or run destructive git commands.
- OUTPUT FORMAT: Exactly 4 concise bullets. No fluff, no transcripts.

## Workflow
1. **Read Active Pointer**:
   - Check `.workflow/active.json` first, then legacy `.workflow/active_task.json` if needed.
   - If missing or points to no task: report that no task is active and suggest `/triage <source>:<id>` or `/pulse`.
2. **Read Active `WORK.md`**:
   - Parse `[META]` (branch, status, phase).
   - Parse `[BRIEF]` (task type, source id, title/outcome).
   - Parse `[PLAN]` (count total slices, checked `[x]` slices, first unchecked `[ ]` slice).
   - Parse `[LOG]` (extract last 1-2 completed milestones/commits and any active PR/MR link).
3. **Check Git State**:
   - Run `git branch --show-current`: Compare with `WORK.md` `[META] Branch`.
   - Run `git status -s`: Check for uncommitted modified/untracked files.
4. **Determine Next Single Action by Phase & State**:
   - If `triaged` -> `Run /frame`
   - If `framed` -> `Run /grill-with-docs`
   - If `grilled` -> `Run /plan`
   - If `planned` -> `Run /implement for <Slice N>`
   - If `implementing`:
     - If uncommitted changes exist in working tree -> `Run /verify for <Slice N> or commit changes`
     - If clean working tree -> `Run /implement for <Slice N>`
   - If `verified` or all slices `[x]` complete -> `Run /sync to update tracker, or merge PR and /post-merge-prune`
5. **Output the 4-Bullet Re-orientation**:
   - Format:
     - **Where we are**: `[source:id]` (`<title/type>`) on `<current-branch>` `[PR #XXX]` • Phase: `<phase>` *(add ⚠️ Branch mismatch warning if git branch != task branch)*
     - **What just happened**: `<last completed action/slice from [LOG] with timestamp/commit>`
     - **In-flight**: `<current unchecked slice from [PLAN]>` + `<git working tree status: clean | N uncommitted files>`
     - **Next single action**: `<exact command to run next>`

## Output Contract
Output exactly:
- **Where we are**: `[source:id]` (`<classification/title>`) on `<branch>` • Phase: `<phase>`
- **What just happened**: `<last completed action/slice from [LOG] with timestamp/commit>`
- **In-flight**: `<current unchecked slice from [PLAN] or uncommitted changes>`
- **Next single action**: `<exact next command to run, e.g. /implement, /verify, /plan, /sync>`
