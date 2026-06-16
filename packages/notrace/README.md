# notrace

Local-first retrospective engine for the Pi Coding Agent.

**Traces in, lessons out.**

notrace captures execution traces — LLM calls, tool executions, token usage, costs — and transforms them into evidence for improvement. It writes an interactive HTML report, a machine-readable `notrace.json` run record, and supports human review sidecars for durable learning.

> **Security warning:** notrace is local-first and redacts common secrets by default, escapes report rendering, blocks network access in generated reports, and writes private report files. Reports can still contain sensitive prompts, tool payloads, outputs, and local paths. Do not publish generated reports.

## Retrospective Spine

The goal is not just a trace viewer, but a feedback loop for workflow engineering:

1. **Capture evidence**: `notrace.json` (automatic)
2. **Review outcome**: `notrace.review.json` (human-in-the-loop)
3. **Compare attempts**: `compare:notrace` (measurable improvement)

## Storage & Workflow Boundary

- **Uniform Storage**: All artifacts live under `.notrace/sessions/<session-id>/`.
- **Workflow Agnostic**: Works in any directory; detects RPIV tasks automatically if present.
- **Optional Attachment**: When RPIV is active, notrace appends artifact references to `WORK.md [LOG]`.
- **Ownership**: `.notrace/` owns evidence; `.workflow/` owns task state.

## Features

- **Session Timeline**: Every turn, tool call, and LLM completion rendered as an expandable card.
- **Metrics Dashboard**: Total tokens, input/output split, cost (USD), duration, and success rates.
- **Machine-Readable Run Record**: Normalized JSON for future automated retrospective flows.
- **Clickable `file://` Links**: Artifact paths printed to console at session end for instant access.
- **Human Review Flow**: CLI for recording outcomes, friction levels, and reusable lessons.
- **Comparison Engine**: Diffs two runs to see if a workflow change (e.g., Headroom, caveman) actually improved efficiency.
- **Safer Defaults**: Secret-key/value redaction and bounded payload sizes by default.

## Usage

```bash
# Load directly
pi --extension ./packages/notrace

# Via nothing mindset
pi --dev
```

## Review & Compare

### Add a human review
```bash
npm run review:notrace -- .notrace/sessions/<id>/notrace.json \
  --outcome partial \
  --friction high \
  --lesson "Headroom reduced tokens but needed manual steering." \
  --next-change "Try same task with RepoScry enabled."
```

Review fields: `outcome` (`success`, `partial`, `failed`, `abandoned`, `inconclusive`), `friction` (`low`, `medium`, `high`), `lesson`, `nextChange`.

### Compare two runs
```bash
npm run compare:notrace -- \
  .notrace/sessions/<baseline-id>/notrace.json \
  .notrace/sessions/<candidate-id>/notrace.json
```

## Capture Controls

By default, notrace uses `NOTRACE_CAPTURE=redacted`.

```bash
NOTRACE_CAPTURE=metadata pi --dev   # no prompt/tool bodies
NOTRACE_CAPTURE=full pi --dev       # unsafe: raw payloads for debugging only
```

## Build

```bash
cd packages/notrace
npm install
npm run build
```

Output lands in `dist/`.
