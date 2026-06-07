# notrace

Phase 0 / POC local-first interactive HTML Trace Viewer for the Pi Coding Agent. It captures execution traces for workflow debugging — LLM calls, tool executions, token usage, costs — and writes an interactive HTML report to your active task workspace at session end.

> **POC warning:** notrace is currently for local experimentation and RPIV observability research. It can capture prompts, tool payloads, outputs, local paths, and accidental secrets. Do not publish generated reports. Redaction, safer rendering, and configurable capture levels are planned follow-up work.

## Features

- **Session timeline**: Every turn, tool call, and LLM completion rendered as an expandable card
- **Metrics dashboard**: Total tokens, input/output split, cache reads, cost (USD), duration
- **Clickable `file://` link**: Report path printed to console at session end for instant browser access
- **Active task aware**: Writes the report into `.workflow/tasks/<task>/notrace.html` when a task is active
- **HTML report**: Intended to become fully self-contained/offline; Phase 0 still needs hardening

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

## Build

```bash
cd packages/notrace
npm install
npm run build
```

Output lands in `dist/`.
