# @raquezha/nosearch

## 0.0.7

### Patch Changes

- Fix three bugs in nochestra extension: null-coalesce cwd, skip remediation prompt on stdin to prevent hang, improve error message to include command name.

## 0.0.6

### Patch Changes

- Add nochestra extension entry to mindsets.json extensions array so pi --nochestra loads the extension.

## 0.0.5

### Patch Changes

- ed13430: Enable direct sub-agent worker process dispatch and Powerline badge rendering for interactive Nochestra session inputs.
- 21c0cef: Auto-approve interactive Nochestra write dispatches and return action handled to stop parent LLM token consumption.
- 45b48e1: Add route recommendation rules for Nochestra stage commands (/frame, /grill-with-docs, /plan, /implement, /verify, /sync, /refine) to prevent chat fallback.
- cf1a779: Fix release closer package listing and expand repository manifest verifications.
- 576a8e4: Fix shellcheck warnings in triage helper and search worker shell scripts.
- f4c23a2: Register Nochestra stage commands natively with pi.registerCommand to guarantee zero LLM token burn.

## 0.0.4

### Patch Changes

- 6eac69d: Relocate core configuration files (`mindsets.json`, `settings.json`, `AGENTS.md`) to a dedicated `config/` directory for better maintainability and a cleaner repository root. Updated `bootstrap.sh` and shell integration to support the new layout.

## 0.0.3

### Patch Changes

- 2ab1520: Fix skill conflicts by auto-expanding skill collections in shell integration.
  Standardize extension structure by moving entrypoints to conventional extensions/ directories. This allows Pi to auto-discover them and display clean labels (e.g., "noagy") without file extensions in the UI.

## 0.0.2

### Patch Changes

- 45022c5: Add public skill installers with `--target pi|claude|codex|all` adapters.
- 2673c7c: Declare Pi package resources, fix nosearch packaged skill lookup, and harden notrace HTML data embedding.
