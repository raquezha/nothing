# notrace: Retrospective Memory

This document stores durable technical memory and design rules for `notrace`.

## Core thesis

**Traces in, lessons out.**

`notrace` is a retrospective engine.
It exists to answer questions like:
- Is this workflow variant actually better?
- Did this extension reduce cost or friction?
- What changed between two sessions?

## Ownership boundary

`notrace` owns the **durable retrospective record**.
It does not own:
- Pi's live footer
- Pi's resume/session UX
- ad hoc terminal presentation strings

When shutdown output appears mixed together, treat `notrace`, Pi core, and dynamic extensions as separate producers unless the run record explicitly aggregates them.

## Architectural principles

1. **Local-first and private**
   - traces stay local
   - generated reports can still contain sensitive data
2. **Evidence vs. judgment**
   - evidence: `notrace.json`
   - judgment: `notrace.review.json`
3. **Unified storage**
   - retrospective artifacts live under `.notrace/`
4. **Workflow attachment, not workflow ownership**
   - `notrace` may attach links into workflow state such as `WORK.md`
   - `.notrace/` still owns retrospective artifacts
5. **Canonical schema first**
   - runtime, HTML, compare, review, and verification should all align to one versioned run-record model
6. **Harness-ready design**
   - Pi is adapter 1 today
   - schema and telemetry contracts should avoid unnecessary Pi-only assumptions so future harness adapters remain possible

## Capture modes

Current default is **redacted** unless `NOTRACE_CAPTURE` is set.

Supported modes:
- `full`
- `redacted`
- `metadata`

Use `metadata` when reduced sensitivity is more important than payload-level debugging.
Use `full` when debugging local extension/runtime behavior and you accept the higher sensitivity.

## Current invariants

- Default capture mode is `redacted`; invalid or missing `NOTRACE_CAPTURE` falls back to `redacted`.
- `metadata` omits prompt/tool/provider bodies; `redacted` preserves bodies but redacts supported sensitive keys and values.
- Non-ghost sessions write both `notrace.json` (canonical event stream) and `notrace.html` (compact session summary).
- Dashboard/index entries carry both `artifacts.html` and `artifacts.record`, and dashboard links prefer per-session HTML summaries which route to `notrace.json` or the shared viewer.
- Static reports are offline-first: local relative links allowed, scheme-based links blocked, inline event handlers avoided, and CSP enforced.

## Metric families

Keep these separate:
- **core session usage**: tokens, cost, turns, tool calls, errors, duration
- **optimization telemetry**: compression attempts, guard skips, tokens saved, transforms applied
- **presentation-only output**: footer badges, live status strings, resume hints

Never mix consumed tokens and saved tokens into one ambiguous total.

## Dynamic extension telemetry

Optional dynamic extensions may contribute structured telemetry.
Current first-class example is `noheadroom`.

Rules:
- absence of an extension must not break `notrace`
- extension telemetry should arrive through a structured contract
- do not scrape UI strings for canonical evidence
- prefer side-channel integration over conversation/session mutation during compression-sensitive flows

## Correlation model

`notrace` accepts optional Nochestra correlation fields (`runId`, `workItemId`, `workerId`, `sessionId`, `epochId`) attached via context pointers or `NOCHESTRA_*` environment variables.
`notrace` only records supplied correlation fields and does not control worker lifecycle or epoch policies.

## Phase 5 report renderer contract

HTML session reports and dashboard views render 7 canonical sections from `notrace.json` (and optional `notrace.review.json`):

1. **Session Summary**: `traceId`, `repository` (`name`, `branch`), `session` (`id`, `startedAt`, `endedAt`, `durationMs`, `shutdownReason`), `conditions` (`harness`, `models`, `providers`, `extensions`), `captureMode`. Fallback: missing fields default gracefully to `"unknown"` or `"generic"`.
2. **Usage Metrics**: `activity.totals` (`inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `totalTokens`, `totalCostUsd`), `activity.context` (`activeTokens`, `peakTokens`, `contextWindow`). Fallback: missing fields default to `0` or `"unavailable"`.
3. **Activity Metrics**: `activity` (`turnCount`, `llmCallCount`, `toolCallCount`, `toolErrorCount`, `durationMs`). Fallback: missing counts default to `0`.
4. **Dynamic Extension Telemetry**: `telemetry.extensions.*` (`loaded`, `enabled`, `active`, `status`, `summary`, `details`). Fallback: absent extensions render clean empty state ("No extension telemetry captured").
5. **Timeline / Events**: `events` array & model switch breakdown. Fallback: empty array renders clean empty state ("No visible events captured").
6. **Workflow / Task Attachments**: `task` (`workflow`, `id`, `path`, `dir`, `role`) & optional `correlation` (`runId`, `workItemId`, `workerId`, `parentSessionId`, `epochId`). Fallback: `task.workflow` defaults to `"generic"`; `correlation` fields rendered conditionally if present. Nochestra telemetry is never required.
7. **Review Status**: Judgment record from `notrace.review.json` (`rating`, `tags`, `notes`, `timestamp`, `reviewer`). Fallback: missing file renders status "Unreviewed".

## Retrospective spine

A session is complete only when it follows the spine:
1. capture
2. inspect
3. review
4. compare

## Mandatory protocol

- Never commit `.notrace/` or `.workflow/`.
- Link, do not copy, retrospective artifacts into workflow docs.
- If a durable repo rule emerges from repeated retrospective lessons, promote it into repo docs or `AGENTS.md`.
