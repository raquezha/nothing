# notrace

Phase 0 / POC local-first trace capture for the Pi Coding Agent. It captures execution traces for workflow debugging — LLM calls, tool executions, token usage, costs — and writes both an interactive HTML report and a machine-readable `notrace.json` run record to your active task workspace at session end.

> **Security warning:** notrace is local-first and now redacts common secrets by default, escapes report rendering, blocks network access in generated reports, and writes private report files. Reports can still contain sensitive prompts, tool payloads, outputs, and local paths. Do not publish generated reports.

## Boundary with RPIV

The relationship is intentionally optional both ways:

- **notrace without RPIV**: should work; notrace-owned artifacts belong under `.notrace/`
- **RPIV without notrace**: should work; `WORK.md` remains the source of truth without any notrace dependency
- **together**: RPIV `WORK.md [LOG]` may reference notrace artifacts, but `.workflow/` should not own them

Neither package should require the other to function.

## Features

- **Session timeline**: Every turn, tool call, and LLM completion rendered as an expandable card
- **Metrics dashboard**: Total tokens, input/output split, cache reads, cost (USD), duration
- **Machine-readable run record**: Normalized `notrace.json` sidecar for future retrospective/compare flows
- **Clickable `file://` links**: Artifact paths printed to console at session end for instant browser access
- **Workdir aware**: notrace-owned artifacts are planned to live under `.notrace/` for the root execution directory
- **RPIV attachment**: When a task has a `WORK.md`, notrace appends artifact/review references into `[LOG]`
- **HTML report**: Self-contained/offline report with a restrictive CSP and no remote font/network loads
- **Safer defaults**: Secret-key/value redaction, bounded payload sizes, metadata-only mode, private file permissions, and `.workflow`-confined artifact writes

## Output

```
🔍 [notrace] Observability artifacts generated:
📂 file:///path/to/.notrace/sessions/<session-id>/notrace.html
📂 file:///path/to/.notrace/sessions/<session-id>/notrace.json
```

## Usage

```bash
# Load directly
pi --extension ./packages/notrace

# Via nothing mindset (dev, rpiv)
pi --dev
```

## NPM

```bash
npm install -g @raquezha/notrace
```

## Add a human review

```bash
npm run review:notrace -- path/to/notrace.json \
  --outcome partial \
  --friction high \
  --lesson "Headroom reduced tokens but needed manual steering." \
  --next-change "Try same task with RepoScry enabled."
```

This writes an adjacent review sidecar. For normal runs that means `notrace.review.json` next to `notrace.json`.

If the run is attached to an RPIV task folder with `WORK.md`, the review is also logged into that task's `[LOG]` section as a reference to the notrace artifact.

Review fields:

- `outcome`: `success`, `partial`, `failed`, `abandoned`, `inconclusive`
- `friction`: `low`, `medium`, `high`
- `lesson`: short human conclusion
- `nextChange`: what to try next run

## Compare two runs

```bash
npm run compare:notrace -- \
  path/to/baseline/notrace.json \
  path/to/candidate/notrace.json
```

This prints a small retrospective diff for:

- total/input/output tokens
- duration
- LLM calls
- tool calls
- tool errors
- total cost
- model/provider mix
- review sidecar outcome/friction/lesson when present

## Capture controls

By default, notrace uses `NOTRACE_CAPTURE=redacted`: it captures useful payloads but redacts common secret keys/values and truncates very large values.

```bash
NOTRACE_CAPTURE=metadata pi --dev   # no prompt/tool payload bodies
NOTRACE_CAPTURE=full pi --dev       # unsafe: raw payloads for local debugging only
```

## Build

```bash
cd packages/notrace
npm install
npm run build
```

Output lands in `dist/`.
