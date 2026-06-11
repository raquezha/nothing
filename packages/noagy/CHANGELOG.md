# @raquezha/noagy

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
