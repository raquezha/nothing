# noresearch

Local-first Research workflow implementation for `nothing`.

`noresearch` is intentionally **not published as an npm package yet**. It is a local workflow bundle used by the `pi --research` hat while the Research workflow proves itself.

## Purpose

Research is for discovery, not implementation.

Use it when you want to intentionally investigate a topic, preserve workflow state, and close with a distilled note, decision, or next experiment.

## Layout

```text
packages/workflows/noresearch/
  research/SKILL.md
  scripts/research_helper.sh
```

Research state is written to the repository being worked on:

```text
.workflow/research/<research-id>/RESEARCH.md
.workflow/research/<research-id>/metadata.json
.workflow/active_workflow.json
```

notrace evidence remains under `.notrace/` and should only be linked from `RESEARCH.md`.

## Commands

```text
/research.start <topic>
/research.log <message>
/research.close [artifact-path]
```

Shortcut through the nothing shell hat:

```bash
pi --research "topic"
```

## Relationship to norpiv

- `@raquezha/norpiv` remains the publishable RPIV execution workflow package.
- `noresearch` is the local discovery workflow bundle.
- The abstract Workflow Contract lives at `docs/workflow.md`.
