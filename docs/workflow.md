# Workflow Contract

`nothing` treats tasks as falling into 3 real modes. Forcing heavy architecture onto fast questions is over-engineering. The human provides intent. The agent manages state.

## The 3 Real Modes

1. **Chat (Ad-hoc / Zero-State)**
   - **Intent:** Disposable. Quick questions, syntax help, one-off tasks.
   - **State:** None. No pointers, no `WORK.md`, no workflow. Ephemeral.
   - **Hat:** `pi`

2. **Research (Discovery State)**
   - **Intent:** Think + write. Intentional investigation, learning, or drafting.
   - **State:** `.workflow/research/<slug>/RESEARCH.md`.
   - **Hat:** `pi --research`. Has auto-start UX: first prompt initializes the workflow automatically. `/distill` is optional, not central.

3. **RPIV (Execution State)**
   - **Intent:** Execution. Changing the system, fixing bugs, shipping features.
   - **State:** `.workflow/tasks/<task-id>/WORK.md` and `.workflow/active.json`.
   - **Hat:** `pi --rpiv` or `pi --android --rpiv`. Needs plans, verification, sync.

## Core rule

```text
one branch/worktree = one active workflow
```

A branch or worktree is the execution lane. The active workflow pointer declares what that lane is doing.

## Generic layout

```text
.workflow/
  active.json
  tasks/
    <task-id>/
      WORK.md
      metadata.json
  research/
    <research-id>/
      RESEARCH.md
      metadata.json
```

`.workflow/active.json` is the generic pointer. (Legacy `active_task.json` may still exist during migration, but `active.json` is the target).

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
| `entry` | command that starts it, or auto-start UX |
| `activePointer` | active workflow pointer path (`.workflow/active.json`) |
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
activePointer: .workflow/active.json
compatPointer: .workflow/active_task.json
stateFile: .workflow/tasks/<task-id>/WORK.md
preEntry:
  - /refine (optional, upstream tracker readiness)
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

Status rule:
- `/refine`, `/triage`, `/frame`, and `/plan` mean the work is being prepared, not actively implemented.
- Remote Jira/GitHub/GitLab work should move to an in-progress state only when `/implement` actually starts.

## Research implementation

```yaml
name: research
intent: discovery — understand something, answer a question (think + write)
question: what do I need to understand and why does it matter?
entry: Auto-start on first prompt, or explicit `/research.start`
activePointer: .workflow/active.json
stateFile: .workflow/research/<research-id>/RESEARCH.md
phases:
  - start
  - log / distill (optional)
  - close
artifact: distilled note or written synthesis
doneSignal: /research.close
notraceHook: attach artifact/review references to RESEARCH.md [TRACE]
```

## Ownership rule

```text
.workflow = workflow state
.notrace  = retrospective evidence
```

Workflow files may link to notrace artifacts, but notrace owns the artifacts.

## GitHub Issues and Projects contract

GitHub Issues define the work. GitHub Projects reflect delivery state.

### Automatic execution metadata

`Status` (`Backlog` → `Ready` → `In progress` → `Review` → `Done`) is execution metadata. When work associated with a Project item transitions as a consequence of actual approved execution, the agent automatically synchronizes the `Status` field after repository and issue state are updated.

### Human-approved planning metadata

The following planning metadata require explicit human approval and must never be mutated silently by an agent:

- `Track`
- `Work type`
- `Priority`
- `Phase`
- `Milestones`
- Issue `Scope` / acceptance criteria / outcomes
- Project `Membership` (adding or removing items)

Creating new scope, altering roadmap commitments, changing track/phase/priority, assigning milestones, or modifying project membership are planning decisions reserved for human approval.

```text
.notrace/sessions/<session-id>/notrace.json
.notrace/sessions/<session-id>/notrace.html
.notrace/sessions/<session-id>/notrace.review.json
```

## Notrace lookup order

When attaching evidence, notrace should prefer:

1. `.workflow/active.json`
2. legacy `.workflow/active_task.json`
3. no-workflow mode under `.notrace/` only

## Package handoff rule

The abstract contract belongs to `nothing`, not to any one package.

Individual packages can still be standalone and npm-installable. A package that implements a workflow should include enough README/SKILL/helper documentation to run that workflow without requiring local repo context.

For `@raquezha/norpiv` specifically:

- RPIV remains handoff-friendly through `norpiv-install` and `npx skills add`.
- `/refine` lives in the norpiv bundle as an optional upstream tracker-readiness skill.
- `.workflow/active.json` is the canonical active pointer.
- `.workflow/active_task.json` is legacy compatibility state during migration.
- `/triage` should project normalized intake into `WORK.md` and keep structured tracker snapshots in `metadata.json`.
- Research is kept as a local workflow bundle under `packages/workflows/noresearch` for now; it is not published to npm yet.

## Domain Boundaries (Hats)

Keep hats as domain boundaries:
- `pi --research` only loads research skills.
- `pi --rpiv` only loads execution skills.
- `pi --android` only loads Android skills.
Combining them is valid (e.g., `pi --android --rpiv`), but there is no "one big auto-router" or "silent directory inference". The human sets the context.
