# Workflow Contract

`nothing` treats RPIV, Research, and future task recipes as implementations of a broader workflow model.

A workflow is a repeatable way to do a kind of task. Skills, extensions, and mindsets are the delivery mechanism; they are not the workflow itself.

## Core rule

```text
one branch/worktree = one active workflow
```

A branch or worktree is the execution lane. The active workflow pointer declares what that lane is doing.

## Generic layout

```text
.workflow/
  active_workflow.json
  tasks/
    <task-id>/
      WORK.md
      metadata.json
  research/
    <research-id>/
      RESEARCH.md
      metadata.json
```

`active_workflow.json` is the generic pointer. Existing RPIV commands may keep writing `.workflow/active_task.json` for compatibility.

Example:

```json
{
  "workflow": "research",
  "id": "notrace-storage-model",
  "stateFile": ".workflow/research/notrace-storage-model/RESEARCH.md",
  "branch": "research/notrace-storage-model",
  "startedAt": "2026-06-16T00:00:00Z"
}
```

## Abstract workflow fields

Every workflow should define:

| Field | Meaning |
|---|---|
| `name` | workflow identifier, e.g. `rpiv`, `research` |
| `intent` | what kind of task it handles |
| `question` | central question the workflow answers |
| `entry` | command that starts it |
| `activePointer` | active workflow pointer path |
| `stateFile` | human-readable state file path |
| `phases` | ordered named steps |
| `artifact` | what done produces |
| `doneSignal` | command/action that closes the workflow |
| `notraceHook` | how notrace attaches evidence |

## RPIV implementation

```yaml
name: rpiv
intent: execution — fix bugs, ship features
question: what needs to be built and how?
entry: /triage
activePointer: .workflow/active_workflow.json
compatPointer: .workflow/active_task.json
stateFile: .workflow/tasks/<task-id>/WORK.md
phases:
  - triage
  - frame
  - grill-with-docs
  - plan
  - implement
  - verify
  - sync
artifact: merge request / tracker update
doneSignal: /sync
notraceHook: attach artifact/review references to WORK.md [LOG]
```

## Research implementation target

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

## Ownership rule

```text
.workflow = workflow state
.notrace  = retrospective evidence
```

Workflow files may link to notrace artifacts, but notrace owns the artifacts.

```text
.notrace/sessions/<session-id>/notrace.json
.notrace/sessions/<session-id>/notrace.html
.notrace/sessions/<session-id>/notrace.review.json
```

## Notrace lookup order

When attaching evidence, notrace should prefer:

1. `.workflow/active_workflow.json`
2. legacy `.workflow/active_task.json`
3. no-workflow mode under `.notrace/` only

## Package handoff rule

The abstract contract belongs to `nothing`, not to any one package.

Individual packages can still be standalone and npm-installable. A package that implements a workflow should include enough README/SKILL/helper documentation to run that workflow without requiring local repo context.

For `@raquezha/norpiv` specifically:

- RPIV remains handoff-friendly through `norpiv-install` and `npx skills add`.
- `.workflow/active_task.json` remains as compatibility state.
- `.workflow/active_workflow.json` is additive generic state, not a breaking replacement.
- Research is kept as a local workflow bundle under `packages/workflows/noresearch` for now; it is not published to npm yet.

## Adding a new workflow

To add a new workflow:

1. Pick a workflow name, e.g. `research`, `bug-bash`, `experiment`.
2. Define the abstract workflow fields using the template below.
3. Choose its state layout under `.workflow/`.
4. Add entry/phase skills under `packages/workflows/<workflow>/` or another package if it owns the workflow.
5. Add helper scripts only when the workflow needs durable filesystem state.
6. Add a mindset/hat in `config/mindsets.json` and `dotfiles/shell_integration.sh`.
7. Define how notrace should attach evidence.
8. Add smoke verification in `scripts/verify-repo.mjs`.
9. Update the owning package/workflow README.

### New workflow template

```yaml
name: <workflow-name>
intent: <execution | discovery | review | publishing | other>
question: <central question this workflow answers>
entry: /<workflow>.start
activePointer: .workflow/active_workflow.json
stateFile: .workflow/<workflow>/<workflow-id>/<STATE_FILE>.md
phases:
  - start
  - <middle phase>
  - close
artifact: <what done produces>
doneSignal: /<workflow>.close
notraceHook: attach artifact/review references to <STATE_FILE>.md [TRACE or LOG]
```

### Minimum files for a stateful workflow

```text
packages/workflows/<workflow>/<phase-or-command>/SKILL.md
packages/workflows/<workflow>/scripts/<workflow>_helper.sh
```

### Minimum repo wiring

- If the workflow is publishable, add the skill path to that package's `package.json` under `pi.skills`.
- If the workflow is local-only, add a README and load it through `config/mindsets.json`.
- Add a mindset in `config/mindsets.json`.
- Add a base hat in `dotfiles/shell_integration.sh` if it should launch with `pi --<workflow>`.
- Mention the hat in `bootstrap.sh` if users should see it after setup.
- Add tests in `scripts/verify-repo.mjs` for skill resolution, helper lifecycle, and shell hat loading.

### State ownership rule

Workflow state belongs under `.workflow/`.

Trace evidence belongs under `.notrace/`.

A workflow state file may reference notrace artifacts, but it must not own them.
