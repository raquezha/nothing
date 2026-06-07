---
name: triage
description: "Ingest or resume a tracked/local task in the RPIV workspace. Use when starting or returning to jira:, github:, gitlab:, or local: work and you need canonical WORK.md state without duplicating scaffold."
---

# Skill: triage

Start RPIV by creating, resuming, or explicitly reopening a task workspace.

## Guardrails
- READ: user argument, `.workflow/active_task.json` when present, target `metadata.json`, and target `WORK.md` when resuming.
- WRITE: `.workflow/tasks/[source-id]/WORK.md`, `.workflow/tasks/[source-id]/metadata.json`, `.workflow/active_task.json`; optional `.reposcry/` cache files only when RepoScry is installed.
- On **create**, initialize required guarded sections only if absent: `[BRIEF]`, `[GRILL]`, `[PLAN]`, `[LOG]`, `[META]`.
- On **resume**, only update `.workflow/active_task.json`, metadata timestamps/state as needed, `[META]`, and append one concise `[LOG]` entry.
- NEVER: duplicate guarded sections.
- NEVER: overwrite existing `[BRIEF]`, `[GRILL]`, or `[PLAN]` during triage.
- NEVER: create `PROBLEM.md`, `PRD.md`, `PLAN.md`, or `EVIDENCE.md`.
- NEVER: implement code during triage.
- NEVER: guess source from `#123`; require explicit `jira:`, `github:`, `gitlab:`, or `local:`.
- NEVER: strip or hide the Jira key for `jira:` tasks; preserve it in `[META]` and in the triage log so `/implement` can require it in the commit subject.
- NEVER: mutate `done` or `archived` tasks unless the user explicitly requested `reopen`, `fresh`, or `reset`.

## Command forms
- `/triage local:setup-v2` — auto mode: create if missing, resume if active/blocked.
- `/triage resume local:setup-v2` — resume existing task; create if missing only when helper reports that behavior.
- `/triage reopen local:setup-v2` — explicitly reopen a done/archived task and mark it active.
- `/triage fresh local:setup-v2` — archive/reset the previous task workspace and create a fresh one.
- `/triage reset local:setup-v2` — alias for fresh/reset behavior when supported by the helper.

## Semantics

### Create
Use when the target task folder does not exist.
- Fetch remote issue data for `github:`, `gitlab:`, or `jira:` sources.
- Create `.workflow/tasks/[source-id]/metadata.json` with at least `id`, `source`, `taskFolder`, `branch`, `status`, `phase`, `createdAt`, `updatedAt`.
- Create `.workflow/tasks/[source-id]/WORK.md` with guarded RPIV sections.
- Set `status=active` and `phase=triaged`.
- Write canonical `.workflow/active_task.json`.

### Resume
Use when the task exists and `status` is `active`, `blocked`, or missing/legacy.
- Do not refetch remote data.
- Do not rewrite the brief, grill notes, or plan.
- Backfill missing metadata fields without destroying unknown fields.
- Refresh active pointer and human-readable `[META]`.
- Append one timestamped `[LOG]` entry such as `Task resumed via /triage`.

### Reopen
Use only when the user explicitly asks to reopen a task that is `done` or `archived`.
- Mark `status=active`.
- Preserve existing `WORK.md` history.
- Append a `[LOG]` entry explaining the reopen.
- Recommend returning to the next valid RPIV stage based on existing sections.

### Fresh / reset
Use only when the user explicitly asks to start over.
- Preserve or archive the old task workspace before creating a new one when the helper supports it.
- Create a new task workspace with clean guarded sections.
- Do not silently delete task history.

### Refuse
Use when auto/resume mode targets a `done` or `archived` task.
- Stop instead of mutating.
- Tell the user to choose `reopen` or `fresh/reset`.

## Workflow
1. Parse optional mode and required namespace:
   - `jira:PROJ-123` -> `jira-PROJ-123`
   - `github:42` -> `github-42`
   - `gitlab:42` -> `gitlab-42`
   - `local:name` -> `local-name`
2. Run the bundled helper script: `../scripts/triage_helper.sh <source> <id> [mode]`.
   - Preferred absolute path: `<skill_dir>/../scripts/triage_helper.sh`.
3. Read the resulting active pointer, metadata, and `WORK.md`.
4. Determine action from helper output and task state: `created`, `resumed`, `reopened`, `refused`, or `fresh/reset`.
5. Optional RepoScry bootstrap: if the bundled `../scripts/reposcry-bootstrap.sh` is available, run it to seed `.reposcry/` for later `/frame` and `/grill-with-docs`. The helper must ensure `.reposcry/` is ignored, must stop if `.reposcry/` is tracked/staged, and should continue normally when RepoScry is unavailable.
6. **Technical Pre-check (Repo Pulse)** for created/reopened/resumed tasks:
   - Extract key filenames, classes, commands, or keywords from the issue/task description.
   - Verify existence on the current branch when concrete files are named.
   - Check recent commits or open PRs only when relevant to the named files/scope.
   - Version-check environment/dependencies only when the task depends on a version claim.
7. Classify the task: Problem / Proposal.
8. **Log Findings**: append concise Repo Pulse and classification findings to `[LOG]` only. Do not edit `[BRIEF]`, `[GRILL]`, or `[PLAN]`.
9. **Branch Guidance**: record the current branch in `[META]`. For `jira:` tasks, also preserve the Jira key in `[META]` and mention that `/implement` must use it in the commit subject. Planning on `main`/`master` is allowed; implementation must use `/implement` branch enforcement.
10. End by recommending the next valid command:
   - newly created -> `/frame`
   - existing with empty `[BRIEF]` -> `/frame`
   - framed but not grilled -> `/grill-with-docs`
   - grilled but not planned -> `/plan`
   - planned -> await explicit `/implement` or `EXECUTE`
   - refused -> ask user to choose `reopen` or `fresh/reset`

## Output contract
End with:
- **Active task**: `[source-id]`
- **Action**: created / resumed / reopened / refused / fresh-reset
- **Status**: active / blocked / done / archived / unknown
- **Phase**: triaged / framed / grilled / planned / implementing / verifying / synced / closed / unknown
- **Branch**: current branch
- **Repo Pulse**: Found / Missing / Outdated / Not applicable
- **Classification**: Problem / Proposal
- **Next step**: `/frame`, `/grill-with-docs`, `/plan`, `/implement`, or explicit reopen/fresh choice
