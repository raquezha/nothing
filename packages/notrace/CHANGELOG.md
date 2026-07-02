# @raquezha/notrace

## 0.1.1

### Patch Changes

- 13be706: refactor: split antigravity monolith and implement dynamic model routing, validated toolConfig, interleaved thinking headers, and empty stream retries

  docs: replace stale public model IDs in notrace sample templates

## 0.1.0

### Minor Changes

- a2fc3cb: Implement machine-global observability dashboard and Mistral-style timeline parser.
  - Storage migrated from `.notrace/` in the local working directory to a machine-wide `~/.notrace/` directory to prevent repository pollution and enable global insights.
  - Dashboard updated with a new `Project` column for multi-repo tracking.
  - Timeline parser overhauled to render LLM arrays, tool execution cards, and code blocks beautifully instead of raw JSON dumps.

### Patch Changes

- 8f31379: fix(noheadroom): match lowercase footer casing
  feat(notrace): add session export to HTML retrospective

## 0.0.7

### Patch Changes

- 5a3e563: Improve session reports by rendering the session ID as a copyable chip under the notrace logo.
- 5a3e563: Enhance the trace header to include the active git branch alongside the repository name, and clarify the capture setting label.
- 7664e50: Polish notrace reliability and installed-package ergonomics: add review/compare package CLIs, validate run records before writing, atomically write private artifacts, recover from corrupt index JSON, and verify capture modes.

## 0.0.6

### Patch Changes

- d349d36: Refresh the notrace UI and sample session rendering separately from the antigravity billing fix.
- 51fda83: fix: preserve assistant toolCall blocks in noheadroom compression and expose notrace failure metadata
- 7afa746: Package updates for antigravity, norpiv, and notrace.

## 0.0.5

### Patch Changes

- 6eac69d: Relocate core configuration files (`mindsets.json`, `settings.json`, `AGENTS.md`) to a dedicated `config/` directory for better maintainability and a cleaner repository root. Updated `bootstrap.sh` and shell integration to support the new layout.
- c19a93a: Add a machine-readable `notrace.json` run record alongside the existing HTML report to normalize captured session/task metadata, activity metrics, and evidence for future retrospective and comparison workflows.

## 0.0.4

### Patch Changes

- f2959b5: Harden notrace reports with default redaction, metadata-only capture support, offline CSP-protected HTML, escaped rendering, private file permissions, and `.workflow`-confined report writes.

## 0.0.3

### Patch Changes

- 2ab1520: Fix skill conflicts by auto-expanding skill collections in shell integration.
  Standardize extension structure by moving entrypoints to conventional extensions/ directories. This allows Pi to auto-discover them and display clean labels (e.g., "noagy") without file extensions in the UI.

## 0.0.2

### Patch Changes

- 2673c7c: Declare Pi package resources, fix nosearch packaged skill lookup, and harden notrace HTML data embedding.
