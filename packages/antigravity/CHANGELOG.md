# @raquezha/antigravity

## 0.0.6

### Patch Changes

- ccc49ba: Fix antigravity billing so the provider cost is tracked correctly.
- 7afa746: Package updates for antigravity, norpiv, and notrace.

## 0.0.5

### Patch Changes

- 6eac69d: Relocate core configuration files (`mindsets.json`, `settings.json`, `AGENTS.md`) to a dedicated `config/` directory for better maintainability and a cleaner repository root. Updated `bootstrap.sh` and shell integration to support the new layout.

## 0.0.4

### Patch Changes

- b56dfd2: Restructure extension entrypoints into package-named index directories so Pi displays clean extension labels without `.ts` suffixes.

## 0.0.3

### Patch Changes

- 40bb5b3: Prefer ANTIGRAVITY*\* environment overrides while retaining NOAGY*\* aliases.
- 2ab1520: Fix skill conflicts by auto-expanding skill collections in shell integration.
  Standardize extension structure by moving entrypoints to conventional extensions/ directories. This allows Pi to auto-discover them and display clean labels (e.g., "noagy") without file extensions in the UI.

## 0.0.2

### Patch Changes

- 2673c7c: Declare Pi package resources, fix nosearch packaged skill lookup, and harden notrace HTML data embedding.
