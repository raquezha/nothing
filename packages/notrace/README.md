# notrace

Zero-dependency, local-first interactive HTML Trace Viewer for the Pi Coding Agent. Captures the full execution trace of a session — LLM calls, tool executions, token usage, costs — and writes a self-contained, interactive HTML report to your active task workspace at session end.

## Features

- **Session timeline**: Every turn, tool call, and LLM completion rendered as an expandable card
- **Metrics dashboard**: Total tokens, input/output split, cache reads, cost (USD), duration
- **Clickable `file://` link**: Report path printed to console at session end for instant browser access
- **Active task aware**: Writes the report into `.workflow/tasks/<task>/notrace.html` when a task is active
- **Self-contained HTML**: No external dependencies — works fully offline

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
