---
name: pulse
description: "Quick health check of the agentic environment (RepoScry, Headroom, notrace) in the current repository. Use to verify if context compression and repo-indexing are active."
---

# Skill: pulse

Display the "Environment Pulse" for the current workspace.

## Guardrails
- READ: `.git`, `.workflow/`, `.notrace/`, and `.reposcry/`.
- NEVER: Start indexing or modifying files. Only report status.

## Workflow
1. Check RepoScry status: Run the bootstrap script with `--pulse`. (Relative path: `../../norpiv/scripts/reposcry-bootstrap.sh`).
2. Check Headroom: Verify if the Docker container `nothing-headroom` is running or if `curl localhost:8788/health` succeeds.
3. Check Notrace: Count the entries in `.notrace/index.json` (or sessions in `.notrace/sessions/`).
4. Read Task: Identify the active task from `.workflow/active_task.json`.

## Output contract
Print a formatted summary:
- **Repo Pulse**: Warm / Cold / Missing
- **Headroom**: online / offline
- **Notrace**: Active (X sessions)
- **Active Task**: [source-id] (or None)
