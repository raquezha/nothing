# PLAN.md

## Goal
Make `notrace` the single durable retrospective layer for a Pi session, with unified metrics assembled from core Pi events plus optional dynamic extension telemetry such as `noheadroom`.

## Current status
Phases 0 through 6 are complete for the current notrace retrospective model. The durable schema, runtime writer, report renderer, documentation, and smoke verification now align around a versioned `notrace-run` record.

Remaining work is limited to Phase 7 compatibility/migration policy for legacy records, which is outside issue #223 scope.

## Completed phases

### Phase 0 - Freeze scope and vocabulary - Complete
Canonical vocabulary is documented in `docs/agents/notrace.md`:
- core session usage
- optimization telemetry
- extension telemetry
- loaded, enabled, and active extension states

### Phase 1 - Design canonical notrace schema - Complete
`notrace.json` is the versioned source of truth for runtime output, HTML rendering, and downstream tooling. The model centers on:
- `kind`
- `schemaVersion`
- `traceId`
- `repository`
- `session`
- `task`
- `correlation`
- `captureMode`
- `conditions`
- `activity`
- `telemetry`
- `events`

Design rules are documented: extension telemetry lives under `telemetry.extensions.*`, consumed tokens stay separate from saved tokens, and presentation-only UI strings are not canonical evidence.

### Phase 2 - Investigate all telemetry sources - Complete
Runtime and verification now cover:
- Pi session lifecycle events
- workflow/task attachment discovery
- provider usage payload normalization
- optional extension telemetry events
- capture modes for `full`, `redacted`, and `metadata`

`npm run verify:notrace` smoke-checks generated records for run markers, activity counts, token totals, redaction behavior, metadata omission, extension telemetry, dashboard output, and task artifact attachment.

### Phase 3 - Dynamic extension telemetry contract - Complete
Optional dynamic extension telemetry is supported through structured extension records. `noheadroom` is the first-class example with:
- loaded / enabled / active state
- status
- summary
- attempts
- applied compressions
- guard skips
- tokens saved

Absence of extension telemetry is handled as an empty state instead of a runtime failure.

### Phase 4 - Unify runtime writer and downstream tooling - Complete
Runtime writer, review, compare, verify, samples, and package docs align on `kind: "notrace-run"` and the canonical run model.

Covered areas:
- `packages/notrace/extensions/notrace/*`
- `packages/notrace/bin/notrace-review.mjs`
- `packages/notrace/bin/notrace-compare.mjs`
- `scripts/verify-notrace.mjs`
- `packages/notrace/templates/*`

### Phase 5 - Report design - Complete
Session reports and dashboard views use the canonical seven-section report contract:
1. Session Summary
2. Usage Metrics
3. Activity Metrics
4. Dynamic Extension Telemetry
5. Timeline / Events
6. Workflow / Task Attachments
7. Review Status

Report fallbacks are documented for missing fields, absent extension telemetry, and missing review records. Static report links are constrained to local relative links.

### Phase 6 - Documentation alignment - Complete
Docs now match the implemented behavior:
- default capture mode is `redacted`
- `full`, `redacted`, and `metadata` modes are documented
- Pi footer output is explicitly separate from `notrace`
- optional extension telemetry is documented
- Nochestra correlation fields are optional evidence, not workflow control state

Primary docs:
- `packages/notrace/README.md`
- `docs/agents/notrace.md`

## Deferred phase

### Phase 7 - Compatibility and migration - Deferred
Legacy record compatibility and migration policy still need an explicit decision if old `.notrace` records must be retained or migrated.

Open decisions:
- whether old records are unsupported, migrated, or tolerated by review/compare tooling
- whether migration is one-shot, lazy, or never performed
- what user-facing error appears for unsupported legacy records

## Risks
- drifting docs from runtime behavior again
- mixing consumed tokens with optimization savings
- coupling `notrace` to live footer strings
- treating optional extension telemetry as required state

## Non-goals
- replacing Pi footer
- replacing Pi resume/session UI
- scraping terminal output as telemetry source
- restructuring monorepo setup scripts

## Definition of done
- [x] `notrace` produces one coherent, versioned retrospective record and report.
- [x] Runtime output matches `packages/notrace/README.md` and `docs/agents/notrace.md`.
- [x] Review, compare, verify, and report tooling share the same canonical run model.
- [x] Optional dynamic extension telemetry is included safely when present.
- [x] Reports remain useful when optional extensions are absent.
- [x] Phases 0-6 are reflected as complete in this plan.
- [ ] Phase 7 compatibility/migration policy is explicitly decided.
