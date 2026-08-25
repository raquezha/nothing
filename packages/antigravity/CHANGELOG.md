# @raquezha/antigravity

## 0.1.0

### Minor Changes

- 7ebccd4: Add support for Gemini 3.7 Flash model catalog, routing, and OAuth dynamic matching.

## 0.0.10

### Patch Changes

- f5592bf: Prune 8 stale model catalog entries from ANTIGRAVITY_ROUTING and ANTIGRAVITY_MODELS that don't map to active agy backend models.
- 61233c8: Add gemini-3.6-flash, fix gemini-3.5-flash stale backend IDs, add claude-sonnet-4-6, fix thinkingLevelMap accuracy for shift-tab cycling, update README routing examples.

## 0.0.9

### Patch Changes

- 98f3291: Fix Antigravity endpoint defaults, restore Gemini 3.5 Flash internal routing, and make common backend errors easier to read.

## 0.0.8

### Patch Changes

- 49f3462: Update routing to match available backend models

## 0.0.7

### Patch Changes

- 13be706: refactor: split antigravity monolith and implement dynamic model routing, validated toolConfig, interleaved thinking headers, and empty stream retries

  docs: replace stale public model IDs in notrace sample templates

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
