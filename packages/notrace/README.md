<p align="center">
  <img src="./assets/notrace-logo.svg" alt="notrace logo" width="240" />
</p>

# notrace

**Traces in, lessons out.**

`notrace` is a local-first retrospective engine for the Pi Coding Agent.
It captures session evidence, writes a versioned `notrace.json` run record, renders a human-readable HTML report, and supports review/compare flows for workflow R&D.

## What notrace owns

When enabled, `notrace` is the durable retrospective layer for a session.
It aggregates:
- core Pi session telemetry
- workflow/task context
- optional dynamic extension telemetry

Today, Pi is the first harness adapter.
The canonical run schema is designed so other harness adapters can be added later, but multi-harness support is not implemented in this package yet.

## What notrace does not own

`notrace` is **not**:
- the live Pi footer
- the Pi resume/session-switch UX
- a scraper of terminal status strings

Live footer output, resume hints, and extension footer badges may appear near `notrace` output during shutdown, but they are separate producers.

## Retrospective spine

1. **Capture evidence**: `notrace.json`
2. **Inspect**: `notrace.html`
3. **Review outcome**: `notrace.review.json`
4. **Compare attempts**: `compare:notrace`

## Storage

```text
.notrace/
  index.json
  index.html
  sessions/
    <session-id>/
      notrace.json
      notrace.html
      notrace.review.json
```

Index rules:
- `index.json` stays compact: one summary entry per session, not duplicated event payloads
- each entry links both `artifacts.html` and `artifacts.record`
- per-session `notrace.html` links back to the shared index/viewer and to its canonical `notrace.json`
- `index.json.lock` protects read-modify-write; if the lock cannot be acquired, notrace keeps the session artifacts and skips only the index update

## Canonical run model

Generated `notrace.json` is the source of truth for runtime output, HTML rendering, and downstream tooling.
The record is versioned and centers on:
- `kind`
- `schemaVersion`
- `traceId`
- `repository`
- `session`
- `task`
- `correlation` (optional Nochestra correlation fields)
- `captureMode`
- `conditions`
- `activity`
- `telemetry`
- `events`

Key rule:
- **consumed tokens** and **saved tokens** are separate metric families
- optimization telemetry belongs under `telemetry.extensions.*`
- presentation-only UI strings are not canonical evidence

## Dynamic extension telemetry

`notrace` can include optional structured telemetry from dynamic extensions.
Current first target is `noheadroom`.

If an extension is absent, `notrace` should still succeed.
If an extension is present, it can contribute a structured summary such as:
- loaded / enabled / active state
- status: `absent`, `loaded-disabled`, `loaded-inactive`, `active`, or `unknown`
- optimization attempts
- tokens saved
- last applied compression summary

Example `noheadroom` detail fields:
- `attempts`
- `applied`
- `guardSkips`
- `tokensSaved`
- `last`

## Capture modes

Default capture mode is **redacted**.

```bash
pi --extension ./packages/notrace
```

Optional modes:

```bash
NOTRACE_CAPTURE=redacted pi --extension ./packages/notrace
NOTRACE_CAPTURE=metadata pi --extension ./packages/notrace
NOTRACE_CAPTURE=full pi --extension ./packages/notrace
```

Mode meanings:
- `redacted`: captured payloads with common secret-like values redacted; default
- `metadata`: minimal capture, no prompt/tool bodies
- `full`: full captured payloads; best for local debugging; highest sensitivity

### Capture mode benchmark evidence

Trace sizes measured on a 25-turn synthetic session (prompt/tool payloads, assistant outputs, usage, context metrics):

| Capture Mode | Trace Size | Storage Reduction | Payload Bodies | Secret Redaction |
| --- | --- | --- | --- | --- |
| `full` | 276 KB (100%) | Baseline | Included | Off |
| `redacted` | 275 KB (~100%) | <1% reduction | Included | Best-effort |
| `metadata` | 24 KB (~8.8%) | ~91% reduction | Omitted | N/A (omitted) |

Default mode remains `redacted` so payload histories are available for local debugging by default. Any change to `metadata` as default remains deferred pending stakeholder review of body availability needs vs storage savings.

### Report/runtime invariants

- Missing or invalid `NOTRACE_CAPTURE` falls back to `redacted`.
- Non-ghost sessions emit both `notrace.json` (canonical event record) and `notrace.html` (compact summary).
- Dashboard/index entries carry both `artifacts.html` and `artifacts.record`.
- Dashboard links prefer per-session HTML summaries which link to `notrace.json` and the shared dashboard viewer (`index.html?session=<id>`), avoiding duplicated trace event content across files.
- Static reports allow only local relative navigation links; scheme URLs are blocked.

### Phase 5 report renderer contract

`notrace.json` defines the 7 canonical report sections. Generated per-session `notrace.html` currently renders the compact canonical summary view; the older full retrospective renderer still uses `Run Summary` and `Timeline` labels for the same underlying data.

Canonical sections:
1. **Session Summary**: `traceId`, `repository` (`name`, `branch`), `session` (`id`, `startedAt`, `endedAt`, `durationMs`, `shutdownReason`), `conditions` (`harness`, `models`, `providers`, `extensions`), `captureMode`.
2. **Usage Metrics**: Consumed tokens (`inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `totalTokens`) and `totalCostUsd`; saved tokens stay under extension telemetry.
3. **Activity Metrics**: Turn count, LLM call count, tool call count, tool error count, session duration.
4. **Dynamic Extension Telemetry**: `telemetry.extensions.*` cards with `status`, `summary`, and `details`. Absent extensions render clean empty states without throwing.
5. **Timeline / Events**: Event stream timeline and model switch breakdown.
6. **Workflow / Task Attachments**: Task context (`workflow`, `id`, `path`, `dir`, `role`) and optional correlation identifiers (`runId`, `workItemId`, `workerId`, `parentSessionId`, `sessionId`, `epochId`). Nochestra correlation fields are optional.
7. **Review Status**: Judgment record from `notrace.review.json` (`outcome`, `friction`, `lesson`, `nextChange`, `runRecord`). Default status is "Unreviewed" when missing.

Nochestra evidence fields render when present:
- worker sessions: `sessionId`, `workerId`, `role`, `route`, `command`, `modelTier`, `status`
- epoch boundaries: `epochId`, optional local `checkpointRef`
- remediation/blocker events: `type`, `description`, `status`
- context quarantine savings: `parentPromptTokens`, `parentContextTokens`, `boundedHandoffTokens`, `quarantineSavingsTokens`, `quarantineSavingsPercent`

Report links pass through `safeHref`: local relative links are allowed, scheme URLs and protocol-relative URLs are blocked.

**Security warning:** `full` reports can contain prompts, tool arguments, tool outputs, local paths, model payloads, and secrets returned by tools. `redacted` mode removes common secret-shaped values and sensitive keys, but redaction is best-effort and can miss project-specific secrets. `metadata` mode is safest for sharing because prompt/tool bodies are omitted, but reports can still reveal repository names, paths, timing, models, providers, and workflow metadata. Do not publish generated reports without review.

## Cleanup

Inspect current local usage:

```bash
cd packages/notrace
npm run cleanup -- --dry-run --json
```

Preview explicit retention by age or size:

```bash
npm run cleanup -- --dry-run --max-age-days 30 --json
npm run cleanup -- --dry-run --max-total-mb 500 --json
```

Apply cleanup only when you mean it:

```bash
npm run cleanup -- --apply --max-age-days 30
```

Rules:
- nothing is deleted unless you pass explicit retention flags with `--apply`
- preserved sessions are skipped when their session directory contains `.preserve`
- stale `index.json.lock` and `*.tmp` artifacts are eligible for cleanup when old enough
- age/size retention uses run/index timestamps when available, then falls back to filesystem mtime

Manual recovery / rollback:
- use `--dry-run` first and review candidate paths before `--apply`
- if cleanup was too aggressive, restore removed session directories from your filesystem backup or Time Machine; `notrace` does not rewrite historical traces or keep a trash folder
- remove retention flags from your command and go back to inspection-only mode

## Review

From this monorepo:

```bash
npm run review:notrace -- \
  .notrace/sessions/<id>/notrace.json \
  --outcome partial \
  --friction high \
  --lesson "Headroom reduced tokens but needed manual steering." \
  --next-change "Try same task with RepoScry enabled."
```

From an installed package:

```bash
npx -p @raquezha/notrace notrace-review \
  .notrace/sessions/<id>/notrace.json \
  --outcome partial \
  --friction high \
  --lesson "Headroom reduced tokens but needed manual steering." \
  --next-change "Try same task with RepoScry enabled."
```

Review fields:
- `outcome`: `success`, `partial`, `failed`, `abandoned`, `inconclusive`
- `friction`: `low`, `medium`, `high`
- `lesson`
- `nextChange`

## Compare

From this monorepo:

```bash
npm run compare:notrace -- \
  .notrace/sessions/<baseline-id>/notrace.json \
  .notrace/sessions/<candidate-id>/notrace.json
```

From an installed package:

```bash
npx -p @raquezha/notrace notrace-compare \
  .notrace/sessions/<baseline-id>/notrace.json \
  .notrace/sessions/<candidate-id>/notrace.json
```

## Templates

HTML source-of-truth lives in `templates/`:
- `dashboard.sample.json`
- `session.sample.json`
- `dashboard.sample.html`
- `session.sample.html`

Refresh previews after renderer changes:

```bash
cd packages/notrace
npm run render:samples
```

## Build

```bash
cd packages/notrace
npm install
npm run build
```

Output lands in `dist/`.
