---
name: triage
description: "Ingest a tracked or local task into the RPIV workspace. Use when starting work from jira:, github:, gitlab:, or local: and you need to create or resume a namespaced WORK.md."
---

# Skill: triage

Start RPIV by creating or resuming a task workspace.

## Guardrails
- READ: user argument `[source]:[id]` and existing `.workflow/active_task.json` if resuming.
- WRITE: `.workflow/tasks/[source-id]/WORK.md`, `.workflow/tasks/[source-id]/metadata.json`, `.workflow/active_task.json`. Within `WORK.md`, write to `[META]` and append to `[LOG]` only.
- NEVER: create `PROBLEM.md`, `PRD.md`, `PLAN.md`, or `EVIDENCE.md`.
- NEVER: implement code during triage.
- NEVER: guess source from `#123`; require explicit `jira:`, `github:`, `gitlab:`, or `local:`.

## Workflow
1. Parse namespace:
   - `jira:PROJ-123` -> `jira-PROJ-123`
   - `github:42` -> `github-42`
   - `gitlab:42` -> `gitlab-42`
   - `local:name` -> `local-name`
2. Use `pi/scripts/norpiv/triage_helper.sh` to fetch remote data and create/resume `.workflow/tasks/[source-id]/WORK.md`.
3. **Technical Pre-check (Repo Pulse)**:
   - Extract key filenames, classes, or keywords from the issue description.
   - Verify existence: Do these files exist on the current branch?
   - Check status: Are there any recent commits (last 72h) or open PRs touching these files?
   - Version check: Verify if the environment (e.g., SDK version, dependencies) matches the issue report.
4. Classify the task: Problem / Proposal.
5. **Log Findings**: Record the Repo Pulse results, classification, and initialization timestamp in `[LOG]` (Format: `YYYY-MM-DD hh:mm AM/PM`). Update `[META]` with branch info.
6. **Branch Guardrail**: If on `main`/`master`, recommend a feature branch. Record the starting branch in `[META]`.
7. End by recommending `/frame` with the pre-check context already loaded.

## Output contract
End with:
- **Active task**: `[source-id]`
- **Repo Pulse**: (Found/Missing/Outdated)
- **Classification**: Problem / Proposal
- **Next step**: `/frame` (Context injected)
