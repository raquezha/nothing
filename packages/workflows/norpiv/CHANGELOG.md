# @raquezha/norpiv

## 0.3.2

### Patch Changes

- Add nochestra extension entry to mindsets.json extensions array so pi --nochestra loads the extension.

## 0.3.1

### Patch Changes

- ed13430: Enable direct sub-agent worker process dispatch and Powerline badge rendering for interactive Nochestra session inputs.
- 21c0cef: Auto-approve interactive Nochestra write dispatches and return action handled to stop parent LLM token consumption.
- 45b48e1: Add route recommendation rules for Nochestra stage commands (/frame, /grill-with-docs, /plan, /implement, /verify, /sync, /refine) to prevent chat fallback.
- cf1a779: Fix release closer package listing and expand repository manifest verifications.
- 576a8e4: Fix shellcheck warnings in triage helper and search worker shell scripts.
- f4c23a2: Register Nochestra stage commands natively with pi.registerCommand to guarantee zero LLM token burn.

## 0.3.0

### Minor Changes

- bedc56b: feat(nochestra): execute true Pi skills in subprocess workers
- 6d68e10: feat(nochestra): record parent worker execution evidence in Notrace

### Patch Changes

- 6a729d5: Implement automatic context epoch compaction and checkpoint synthesis in Nochestra parent runtime

## 0.2.1

### Patch Changes

- b25deb3: feat(nochestra): show precise write scope in approval prompts
- 02607ee: docs(norpiv/sync): enhance sync skill to traverse and update all related issues, descriptions, checkboxes, and statuses

## 0.2.0

### Minor Changes

- e95ddc1: Implement CLI sub-process worker runner for nochestra and enforce markdown hyperlinking in sync skill (Refs #140)

## 0.1.0

### Minor Changes

- 5fdcdea: Consume NoDesign preflight before planning UI-sensitive work and expand non-Jira design link resolution.

  Refs #100

### Patch Changes

- b77b3ce: Block planning and implementation when required UI or formula evidence is missing (#87).
- c69a8f6: Add evidence classification for UI-sensitive, formula-sensitive, and backend-safe tasks (#86).
- 1e6332d: Add Pi MCP adapter (`npm:pi-mcp-adapter@2.11.0`) auto-installation to environment bootstrap.
- 8957bcd: Isolate task evidence under `.workflow/tasks/<task-id>/evidence/` to prevent cross-task evidence collisions and cwd substitute discovery.

## 0.0.8

### Patch Changes

- 82a5634: Add a fail-open Graphify helper that analyzes only a temporary archive of committed `HEAD`. Refs #66.
- b0c4c93: Install Graphify machine-wide in `~/.graphify/venv` and let the RPIV grill helper prefer that shared environment with repo-local fallback.
- 2efb686: Refine `/refine` ownership/dependency guidance and clarify that remote tracker items move to in-progress only when `/implement` starts.
- a6dabbb: Prefer `.workflow/active.json` as the canonical RPIV pointer in workflow helpers and derive phase from `WORK.md` state instead of metadata phase storage.
- 31df5f7: Harden sync guidance to verify child issue targets before posting status and require file-based markdown updates.

  Refs #63
  Refs #65

## 0.0.7

### Patch Changes

- 9b509ab: Move the RPIV workflow package under `packages/workflows/norpiv` and add generic `.workflow/active.json` compatibility while preserving legacy `.workflow/active_task.json` behavior.

## 0.0.6

### Patch Changes

- 1add263: Rename the cleanup skill to post-merge-prune, move the skill directory to match, update norpiv package skill metadata and bundled docs, refresh installer/lifecycle references, and tighten the instructions around post-merge branch pruning.

## 0.0.5

### Patch Changes

- 7afa746: Package updates for antigravity, norpiv, and notrace.

## 0.0.4

### Patch Changes

- 6eac69d: Relocate core configuration files (`mindsets.json`, `settings.json`, `AGENTS.md`) to a dedicated `config/` directory for better maintainability and a cleaner repository root. Updated `bootstrap.sh` and shell integration to support the new layout.

## 0.0.3

### Patch Changes

- 00015e2: Add the distill skill for saving useful conversation residue as Obsidian-ready notes.

## 0.0.2

### Patch Changes

- 45022c5: Add public skill installers with `--target pi|claude|codex|all` adapters.
- 2673c7c: Declare Pi package resources, fix nosearch packaged skill lookup, and harden notrace HTML data embedding.
