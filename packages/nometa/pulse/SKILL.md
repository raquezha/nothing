---
name: pulse
description: "Quick health check of the agentic environment (Headroom, notrace, active workflow) in the current repository."
---

# Skill: pulse

Display the "Environment Pulse" for the current workspace.

## Guardrails
- READ: `.git`, `.workflow/`, and `.notrace/`.
- NEVER: Start indexing or modifying files. Only report status.

## Workflow
1. Run the root bootstrap script with `--pulse` for a consolidated status readout.
2. Check Headroom: Verify if the Docker container `nothing-headroom` is running or if `curl localhost:8788/health` succeeds.
3. Check Notrace: Count the entries in `.notrace/index.json` (or sessions in `.notrace/sessions/`).
4. Read Task: Identify the active task from `.workflow/active.json`.

## Output contract
Print a formatted summary:
- **Headroom**: online / offline
- **Notrace**: Active (X sessions)
- **Active Task**: [source-id] (or None)
