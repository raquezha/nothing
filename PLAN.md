# PLAN.md

## Goal
Make `notrace` the single durable retrospective layer for a Pi session, with unified metrics assembled from core Pi events plus optional dynamic extension telemetry such as `noheadroom`.

## Current problems
1. Shutdown output is visually mixed from multiple producers:
   - Pi core session footer / resume output
   - `notrace` retrospective link
   - `noheadroom` / Headroom status
2. `notrace` runtime schema drifts from its own tooling:
   - runtime writes a simple record
   - `review`, `compare`, and `verify` expect `kind: "notrace-run"` and richer fields
3. Docs drift from code:
   - docs say redacted by default
   - code is full by default
4. Dynamic extension telemetry is not part of the durable `notrace` model yet.

## Product direction
When enabled, `notrace` should be the session retrospective source of truth.
It should aggregate:
- core Pi telemetry
- workflow/task context
- optional dynamic extension telemetry

It should not try to own:
- live Pi footer UI
- resume/session switching UX
- brittle scraping of footer strings

## Plan

### Phase 0 - Freeze scope and vocabulary
Define exact meanings for:
- core metrics
- optimization metrics
- extension telemetry
- enabled vs loaded vs active extension

Deliverable:
- one canonical retrospective model description

### Phase 1 - Design canonical notrace schema
Introduce a versioned run record, likely centered on:
- `kind`
- `schemaVersion`
- `traceId`
- `repository`
- `session`
- `workflow`
- `capture`
- `conditions`
- `activity`
- `totals`
- `telemetry`
- `events`

Design rules:
- one durable source of truth
- extension telemetry nested under `telemetry.extensions`
- consumed tokens and saved tokens kept separate

### Phase 2 - Investigate all telemetry sources
Map what can be sourced from:
- Pi event hooks
- workflow adapters
- provider usage payloads
- optional extension runtime data

Open investigation items:
1. What exact usage fields appear across providers?
2. What should count as canonical input/output/total tokens?
3. Which session metadata should be captured at shutdown?

### Phase 3 - Dynamic extension telemetry contract
Design an optional contract so extensions can contribute structured telemetry without hard coupling.

Requirements:
- no failure if extension absent
- explicit status if extension present but inactive or blocked
- structured data if extension active

Initial target:
- `noheadroom`

Likely fields for `noheadroom`:
- loaded
- enabled
- active
- attempts
- applied
- guardSkips
- tokensSaved
- last compression summary

### Phase 4 - Unify runtime writer and downstream tooling
Bring these into schema alignment:
- `packages/notrace/extensions/notrace/index.ts`
- `scripts/notrace-review.mjs`
- `scripts/notrace-compare.mjs`
- `scripts/verify-notrace.mjs`
- templates and samples

Acceptance target:
- a real generated `notrace.json` must work with review/compare/verify without adapters or manual patching

### Phase 5 - Report design
Update HTML/dashboard to reflect unified retrospective model.

Suggested sections:
- session summary
- usage metrics
- activity metrics
- dynamic extension telemetry
- timeline/events
- workflow/task attachments
- review status

### Phase 6 - Documentation alignment
Update docs to match actual behavior and new design.

Must fix:
- default capture mode is `full`
- `redacted` and `metadata` remain supported options
- clarify difference between Pi footer and `notrace`
- document optional extension telemetry

Files likely affected:
- `packages/notrace/README.md`
- `docs/agents/notrace.md`
- any root docs that describe notrace behavior

### Phase 7 - Compatibility and migration
Decide explicitly:
- whether to support legacy records
- whether to migrate old records
- whether compare/review should tolerate old schema

Deliverable:
- compatibility policy before implementation

## Investigation checklist before implementation
1. Audit `review`, `compare`, `verify` expected schema fields.
2. Audit provider `usage` payload variations across models/providers.
3. Decide extension telemetry contract shape.
4. Decide compatibility policy for existing `.notrace` records.
5. Define final HTML/report layout from canonical schema.

## Implementation order
1. Finalize schema spec
2. Finalize telemetry contract
3. Update runtime writer
4. Update review/compare/verify
5. Update renderer/templates
6. Integrate `noheadroom` telemetry
7. Update docs
8. Validate with smoke tests and real session output

## Risks
- trying to mirror live footer exactly
- mixing token consumption with token savings
- coupling `notrace` directly to UI strings
- changing schema without compatibility plan

## Non-goals
- replacing Pi footer
- replacing Pi resume/session UI
- scraping terminal output as telemetry source

## Definition of done
`notrace` should produce one coherent, versioned retrospective record and report that:
- matches its own docs
- matches its own scripts
- includes optional dynamic extension telemetry safely
- stays useful even when optional extensions are absent
