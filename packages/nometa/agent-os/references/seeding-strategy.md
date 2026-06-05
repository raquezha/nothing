# Seeding Strategy (Agent-OS)

## Why Seed?
AI agents often struggle to understand a repository's "Vibe," domain, and current work state in the first few turns. Seeding provides "Firmware" that the agent loads immediately, reducing hallucinations and onboarding time.

## Core Components
1. **Bootstrap Header**: A mandatory section in `AGENTS.md` that tells the agent to read `CONTEXT.md` and `WORK.md` before doing anything else.
2. **High-Density Context**: `CONTEXT.md` should favor bullet points, architecture diagrams (Mermaid), and "Agent Requirements" over long prose.
3. **Durable Memory**: The `.workflow/` directory ensures that task state survives even if the agent's underlying model is swapped.

## Anti-Staleness Loop
- Run `pi agent-os` periodically to check for "Context Drift."
- If the stack or directory structure changes, the sync script will propose updates.
- Manually curate these updates using `/update-docs`.
