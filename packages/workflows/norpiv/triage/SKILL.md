---
name: triage
description: "Ingest or resume a tracked/local task in the RPIV workspace. Use when starting or returning to jira:, github:, gitlab:, or local: work and you need canonical WORK.md state without duplicating the scaffold."
---

# Skill: triage

Start RPIV by creating, resuming, or explicitly reopening a task workspace.

## Guardrails
- READ: user argument, `.workflow/active_task.json` if present, target `metadata.json`, and target `WORK.md` if resuming.
- WRITE: `.workflow/tasks/[source-id]/WORK.md`, `.workflow/tasks/[source-id]/metadata.json`, `.workflow/active_task.json`; optional `.reposcry/` cache files only if RepoScry is installed.
- On **create**, initialize required guarded sections only if absent: `[BRIEF]`, `[GRILL]`, `[PLAN]`, `[LOG]`, `[META]`.
- On **resume**, only update `.workflow/active_task.json`, metadata timestamps/state as needed, and `[META]`, then append one concise `[LOG]` entry.
- NEVER: duplicate guarded sections.
- NEVER: overwrite existing `[BRIEF]`, `[GRILL]`, or `[PLAN]` during triage.
- NEVER: create `PROBLEM.md`, `PRD.md`, `PLAN.md`, or `EVIDENCE.md`.
- NEVER: implement code during triage.
- NEVER: guess source from `#123`; require explicit `jira:`, `github:`, `gitlab:`, or `local:`.
- NEVER: strip or hide the Jira key for `jira:` tasks; preserve it in `[META]` and in the triage log so `/implement` can require it in the commit subject.
- NEVER: mutate `done` or `archived` tasks unless the user explicitly requested `reopen`, `fresh`, or `reset`.

## Command forms

### /triage local:setup-v2
- **Standard/auto mode**: create if missing, resume if active/blocked.
- Will not rewrite brief, grill notes, or plan.
- Backfill missing metadata fields without destroying unknown fields.
- Refresh active pointer and human-readable `[META]`.
- Append one timestamped `[LOG]` entry such as `Task resumed via /triage`.

### /triage local:setup-v2 reopen
- Use only if user explicitly asks to reopen a task that is `done` or `archived`.
- Mark `status=active`.
- Preserve existing `WORK.md` history.
- Append a `[LOG]` entry explaining the reopen.
- Recommend returning to the next valid RPIV stage based on existing sections.

### /triage local:setup-v2 fresh / reset
- Use only if user explicitly asks to start over.
- Preserve or archive old task workspace before creating new one when helper supports it.
- Create new task workspace with clean guarded sections.
- Do not silently delete task history.

### Refuse
- Use when auto/resume mode targets a `done` or `archived` task.
- Stop instead of mutating.
- Tell user to choose `reopen` or `fresh/reset`.

## Workflow

1. Parse optional mode and required namespace:
   - `jira:PROJ-123` -> `jira-PROJ-123`
   - `github:42` -> `github-42`
   - `gitlab:42` -> `gitlab-42`
   - `local:name` -> `local-name`
2. Run the bundled helper script: `../scripts/triage_helper.sh <source> <id> [mode]`.
   - Preferred absolute path: `<skill_dir>/../scripts/triage_helper.sh`.
3. Read the resulting active pointer, metadata, and `WORK.md`.
4. Determine action based on helper output and task state: `created`, `resumed`, `reopened`, `refused`, `fresh/reset`.
5. Optional RepoScry bootstrap: if bundled `../scripts/reposcry-bootstrap.sh` available, run it to seed `.reposcry/` for later `/frame` and `/grill-with-docs`.
   - Run `../scripts/reposcry-bootstrap.sh --pulse` to determine "Repo Pulse" (Warm/Cold/Missing) for the output contract.
   - Run `../scripts/reposcry-bootstrap.sh` to ensure the local cache is initialized.
   - The helper must ensure `.reposcry/` is ignored, must stop if `.reposcry/` tracked/staged, and continue normally if RepoScry is unavailable.
6. Verify branch: ensure current branch matches metadata `branch` (or is `main`/`master` for planning).
7. If task was newly created, infer classification:
   - `github:`, `gitlab:`, `jira:` labels/type often indicate Problem (bug) or Proposal (feature).
   - Local tasks default to Proposal unless specified.
8. If resuming, check `[BRIEF]` and `[PLAN]` completion status.
9. **Final Guidance**: record current branch in `[META]`. For `jira:` tasks, also preserve the Jira key in `[META]` and mention `/implement` must use it in the commit subject. Planning on `main`/`master` allowed; implementation will use `/implement` branch enforcement.
10. End by recommending next valid command:
    - newly created -> `/frame`
    - existing empty `[BRIEF]` -> `/frame`
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
- **Repo Pulse**: Warm / Cold / Missing / Not applicable
- **Classification**: Problem / Proposal
- **Next step**: `/frame`, `/grill-with-docs`, `/plan`, `/implement`, or explicit reopen/fresh choice
