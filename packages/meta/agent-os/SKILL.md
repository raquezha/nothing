---
name: agent-os
description: Initialize or synchronize "Agent-First" infrastructure (AGENTS.md, CONTEXT.md) in any repository. Use when you land in a new or undocumented codebase and need to make it instantly navigable for AI agents.
---

# Skill: agent-os

Turn any repository into a high-density "Agent-Ready" workspace.

## Usage

### Initialize a new repo
```bash
./scripts/init.sh
```

### Sync/Update context
```bash
./scripts/sync.sh
```

## Guardrails
- READ: Root directory structure and `package.json`, `requirements.txt`, etc.
- WRITE: `AGENTS.md`, `CONTEXT.md`, and `.workflow/` directory.
- NEVER: Overwrite a custom `AGENTS.md` without creating a backup.
- NEVER: Read `.env` or `.secrets` files.

## Workflow

### 1. Init (Bootstrap)
- Runs `scripts/discover.sh` to identify the tech stack.
- Drops `AGENTS.md` with the mandatory `⚡️ AGENT BOOTSTRAP` header.
- Drops `CONTEXT.md` with structured sections for Domain and Tech Stack.
- Creates a git-ignored `.workflow/` folder for task tracking.

### 2. Sync (Anti-Staleness)
- Scans for new dependencies or structural changes.
- Compares findings against `CONTEXT.md`.
- Proposes updates to keep context dense and accurate.

## Output contract
End with:
- **Status**: (Initialized / Synced)
- **Detected Stack**: (e.g. Node/TypeScript/Jest)
- **Files Created/Updated**: (List)
- **Next step**: Agent should perform a "Firmware Load" by reading the new docs.
