# notrace

Phase 0 / POC local-first interactive HTML Trace Viewer for the Pi Coding Agent. It captures execution traces for workflow debugging — LLM calls, tool executions, token usage, costs — and writes an interactive HTML report to your active task workspace at session end.

> **Security warning:** notrace is local-first and now redacts common secrets by default, escapes report rendering, blocks network access in generated reports, and writes private report files. Reports can still contain sensitive prompts, tool payloads, outputs, and local paths. Do not publish generated reports.

## Features

- **Session timeline**: Every turn, tool call, and LLM completion rendered as an expandable card
- **Metrics dashboard**: Total tokens, input/output split, cache reads, cost (USD), duration
- **Clickable `file://` link**: Report path printed to console at session end for instant browser access
- **Active task aware**: Writes the report into `.workflow/tasks/<task>/notrace.html` when a task is active
- **HTML report**: Self-contained/offline report with a restrictive CSP and no remote font/network loads
- **Safer defaults**: Secret-key/value redaction, bounded payload sizes, metadata-only mode, private file permissions, and `.workflow`-confined report writes

## Output

```
🔍 [notrace] Observability report generated:
📂 file:///path/to/.workflow/tasks/my-task/notrace.html
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
