---
name: update-docs
description: Curate durable repo documentation after workflow, skill, setup, or process changes. Use when the user asks to update AGENTS.md, README, skill docs, repo instructions, or document what changed without creating context bloat.
---

# Skill: update-docs

Prevent docs drift and context bloat. Update durable repo documentation so future pi sessions match current repo reality.

## Guardrails
- READ first: `AGENTS.md`, `pi/AGENTS.md`, `README.md`, `pi/skills/README.md`, and relevant `SKILL.md` files.
- WRITE durable docs only; task state stays in `.workflow/tasks/*/WORK.md`.
- NEVER dump conversation history.
- NEVER add secrets, credentials, env values, or private tokens.
- NEVER edit docs during planning unless the user explicitly asks to update docs.

## Workflow
1. Identify what changed in workflow, setup, hats, skills, or repo process.
2. Classify each update using `references/doc-destination-map.md`.
3. Propose or apply the smallest durable doc edits that reflect the current state.
4. Prefer rules and decisions over event history.
5. Validate that docs match actual files, commands, hats, and skill names.

## Output contract
End with:
- **Docs updated**: paths changed
- **Why**: one-line reason per file
- **Not documented**: anything intentionally left out to avoid bloat
- **Reload needed**: whether to run `./scripts/setup.sh` or `/reload`

## References
- `references/doc-destination-map.md`
