# @raquezha/notrace

## 0.4.1

### Patch Changes

- 555f637: Align notrace README report model docs with the implemented Phase 5 renderer and index behavior.

## 0.4.0

### Minor Changes

- d44e4d4: Render Nochestra Phase 4 workflow evidence and context quarantine savings in Notrace reports

### Patch Changes

- 7a58dd7: Align dashboard samples and vitest suites with Phase 5 retrospective report model.
- f83fc3b: Define Phase 5 report architecture contract and renderer section fallbacks for session reports and dashboard views
- ec0e662: Render dynamic extension telemetry panels in Notrace reports with safe absent, inactive, blocked, and active states.
- f6b67ce: Render session summary, usage metrics, activity metrics, and timeline sections in session report HTML.

## 0.3.0

### Minor Changes

- 2340c8d: feat(nochestra): implement Notrace context quarantine telemetry and efficiency reporting
- 6d68e10: feat(nochestra): record parent worker execution evidence in Notrace

## 0.2.7

### Patch Changes

- 98f50d1: Add parent session correlation to Notrace records and session summaries, and propagate worker parent session envs from Nochestra dispatch.

## 0.2.6

### Patch Changes

- bda3462: Add a baseline test that pins current per-session HTML storage duplication versus the canonical notrace.json record.
- 8e639b5: Store session trace events in canonical `notrace.json` without creating duplicate per-session HTML report files.

## 0.2.5

### Patch Changes

- f280cc9: Benchmark capture modes, add capture mode regression coverage, prove configured default mode, and document trace storage comparison.

## 0.2.4

### Patch Changes

- 3bb5407: Add explicit Notrace cleanup retention controls, preserve markers, and cleanup documentation.
- 892773d: Add a `notrace-cleanup` CLI for local disk-usage inspection and dry-run cleanup previews.
- 57015e6: Store session trace events in canonical `notrace.json` without creating duplicate per-session HTML report files.
- 41b1a99: Record Pi compaction and context epoch boundaries as passive telemetry events.

## 0.2.3

### Patch Changes

- 97009b2: Add optional Nochestra correlation fields (runId, workItemId, workerId, sessionId, epochId) to Notrace run record and reports.

  Refs #84

- 9dfea92: Measure active tokens, peak context, context window, message count, and session role markers in session retrospective records

## 0.2.2

### Patch Changes

- ac8aa47: Recognize canonical `.workflow/active.json` workflow pointer in Notrace ActiveWorkflowAdapter.

## 0.2.1

### Patch Changes

- d017f01: Default captures to redacted mode, store index artifact paths relative to `.notrace`, and honor generic `active_workflow.json` before legacy RPIV task detection.

## 0.2.0

### Minor Changes

- 382b624: Add model usage breakdowns, switch insights, lazy timeline rendering, and refreshed report samples.

### Patch Changes

- 04d574e: Refactor notrace report rendering into modular report-app files and add focused regression coverage without changing package dependencies or entrypoints.

## 0.1.2

### Patch Changes

- a0f076e: Fix notrace index lock behavior under contention and add regression coverage for lock handling and usage normalization.
- 894da0a: Add Vitest scaffolding and extract `handleSessionShutdown` for testability with no intended runtime behavior change.
- 9d6c8b2: Skip writing per-session notrace artifacts for ghost sessions and add regression coverage for ghost vs non-ghost shutdown behavior.

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
