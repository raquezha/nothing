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

## Canonical run model

Generated `notrace.json` is the source of truth for runtime output, HTML rendering, and downstream tooling.
The record is versioned and centers on:
- `kind`
- `schemaVersion`
- `traceId`
- `repository`
- `session`
- `task`
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
- optimization attempts
- tokens saved
- last applied compression summary

## Capture modes

Default capture mode is **full**.

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
- `full`: full captured payloads; best for local debugging; highest sensitivity
- `redacted`: captured payloads with common secret-like values redacted
- `metadata`: minimal capture, no prompt/tool bodies

**Security warning:** even redacted reports can contain sensitive prompts, tool payloads, local paths, and outputs. Do not publish generated reports.

## Review

```bash
npm run review:notrace -- \
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

```bash
npm run compare:notrace -- \
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
