# notrace: Retrospective Memory

This document stores the durable technical memory and design rules for `notrace`.

## The Core Thesis

**Traces in, lessons out.**

`notrace` is not a dashboard or a monitoring tool. It is a **retrospective engine**. Its purpose is to provide measurable evidence to answer the question: *"Is this workflow variant actually improving the value of my agent sessions?"*

## Architectural Principles

1.  **Local-First & Private**: Traces are sensitive. They remain on the local machine and use aggressive redaction (`REDACTED`) for secrets by default.
2.  **Evidence vs. Judgment**:
    *   **Evidence** (`notrace.json`): Automatically captured logs of LLM calls, tool execution, and usage metrics.
    *   **Judgment** (`notrace.review.json`): Human-provided outcome, friction level, and lesson.
3.  **Unified Storage**: All artifacts live in `.notrace/sessions/<id>/`. No retrospective artifacts are owned by the workflow engine (e.g., RPIV).
4.  **Workflow Adapters**: `notrace` is workflow-agnostic. It detects active workflows (like RPIV) and "attaches" references to those sessions in the workflow's state (e.g., `WORK.md`).

## The Retrospective Spine

A session is considered complete only when it follows the spine:
1.  **Capture**: Extension runs during the session.
2.  **Inspect**: Review the generated `notrace.html`.
3.  **Review**: Run `npm run review:notrace` to record the human verdict.
4.  **Compare**: Run `npm run compare:notrace` against a baseline to measure improvement.

## Storage Schema

```text
.notrace/
  index.json              # Registry of all sessions in this root
  sessions/
    <session-id>/
      notrace.json        # The machine-readable spine
      notrace.html        # The human-readable report
      notrace.review.json # The human judgment sidecar
```

## Mandatory Protocol (for Agents)

*   **Never commit `.notrace/` or `.workflow/`** to git.
*   **Always use redacted mode** unless debugging local extension logic.
*   **Link, don't copy**: RPIV `WORK.md` should only contain relative `file://` links to `.notrace/` artifacts.
*   **Durable lessons**: When a significant lesson is extracted via `review:notrace`, consider promoting it to a repo-level rule in `AGENTS.md`.
