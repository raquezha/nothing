---
name: research
workflow: research
workflowPhase: start-log-close
description: Start, log, and close a first-class research workflow in .workflow/research. Use when the user wants intentional research with durable state, not an RPIV implementation task.
---

# Skill: research

Run intentional research as a first-class `nothing` workflow.

Research is for discovery, not implementation. The output is a durable note or decision, not a merge request.

## Workflow contract

```yaml
name: research
intent: discovery — understand something, answer a question
question: what do I need to understand and why does it matter?
entry: /research.start
activePointer: .workflow/active_workflow.json
stateFile: .workflow/research/<research-id>/RESEARCH.md
phases:
  - start
  - explore
  - log
  - distill
  - close
artifact: distilled note
doneSignal: /research.close
notraceHook: attach artifact/review references to RESEARCH.md [TRACE]
```

## Core rule

```text
one branch/worktree = one active workflow
```

If another workflow is active in this branch/worktree, do not overwrite it. Ask the user to close it or use a separate worktree/branch.

## Storage

Research workflow state lives under `.workflow`:

```text
.workflow/
  active_workflow.json
  research/
    <research-id>/
      RESEARCH.md
      metadata.json
```

notrace evidence must stay under `.notrace/`. `RESEARCH.md` should only link to notrace artifacts.

## Command forms

- `/research.start <topic>` — create or resume a research workflow.
- `/research.log <message>` — append a timestamped research log entry.
- `/research.close [artifact-path]` — close the active research workflow and optionally link the distilled note or artifact.

## Helper

Use the bundled helper script:

```bash
<skill_dir>/../scripts/research_helper.sh start "<topic>"
<skill_dir>/../scripts/research_helper.sh log "<message>"
<skill_dir>/../scripts/research_helper.sh close "<artifact-path>"
```

Resolve `<skill_dir>` to this skill directory. Prefer the absolute path when invoking the helper.

## /research.start workflow

1. Parse the topic from the user request.
2. Run `research_helper.sh start "<topic>"`.
3. Read `.workflow/active_workflow.json` and the created `RESEARCH.md`.
4. State the research question back to the user.
5. Begin research using the minimum useful tools.

Output contract:

- **Active workflow**: `research/<research-id>`
- **State file**: `.workflow/research/<research-id>/RESEARCH.md`
- **Question**: concise restatement
- **Next step**: explore, search, or `/research.log`

## /research.log workflow

Use this when the user wants to capture a finding, decision, or mid-session checkpoint.

1. Run `research_helper.sh log "<message>"`.
2. Do not summarize the whole session unless asked.
3. Keep the log short and factual.

Output contract:

- **Logged**: yes/no
- **State file**: active `RESEARCH.md`

## /research.close workflow

Use when the research question has produced a useful artifact, decision, or next experiment.

1. If the conversation produced reusable thinking and the user has not already done so, recommend `/distill` first.
2. If a distilled note or artifact path is available, pass it to the helper.
3. Run `research_helper.sh close [artifact-path]`.
4. Confirm the workflow is closed.

Output contract:

- **Closed workflow**: `research/<research-id>`
- **Artifact**: linked path if available
- **State file retained**: path
- **Next step**: none, next research, or promote to RPIV only if user explicitly wants implementation

## Guardrails

- READ: `.workflow/active_workflow.json`, active `RESEARCH.md`, and relevant source materials.
- WRITE: `.workflow/research/<research-id>/RESEARCH.md`, `metadata.json`, and `.workflow/active_workflow.json` only through the helper.
- NEVER create `.workflow/tasks/*/WORK.md` for research.
- NEVER start RPIV automatically from research.
- NEVER treat a research answer as verified implementation.
- NEVER store trace artifacts in `.workflow`; link to `.notrace` artifacts only.
- Keep research lightweight. The point is a durable question, findings, trace links, and a closing artifact.

## Relationship to RPIV

```text
research -> distilled note / decision / next experiment
rpiv     -> implementation plan / code / MR
```

Research can produce a promotion signal, but promotion is manual. The user must explicitly choose to start RPIV.
