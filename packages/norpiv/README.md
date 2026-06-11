# norpiv (Lean RPIV Workflow Engine)

RPIV: a gated workflow for reliable AI coding agents.

## 🔁 The Lifecycle

The RPIV engine splits task execution into separate, focused phases:

| Phase | Command | Purpose | Input / Output Files |
| :--- | :--- | :--- | :--- |
| **1. Ingest** | `/triage [source]:[id]` | Initial task verification and workspace setup. | Creates `.workflow/tasks/[source-id]/WORK.md` & `metadata.json` |
| **2. Scoping** | `/frame` | Author a clear, structured task brief. | Populates `WORK.md` ➔ `[BRIEF]` section |
| **3. Interrogate**| `/grill-with-docs` | Stress-test brief against rules and docs. | Records decisions in `WORK.md` ➔ `[GRILL]` |
| **4. Strategy** | `/plan` | Draft thin, independently testable slices. | Writes checkbox items in `WORK.md` ➔ `[PLAN]` |
| **5. Coding** | `/implement` | Execute one approved plan slice (needs permission). | Modifies code; records updates in `WORK.md` ➔ `[LOG]` |
| **6. Truth Test** | `/verify` | Run tests, lint, and verify quality. | Appends results to `[LOG]` |
| **7. Close** | `/sync` | Bridge local progress with external trackers. | Posts summary updates to Jira, GitHub, or GitLab |

Auxiliary hygiene:

| Command | Purpose | Input / Output Files |
| :--- | :--- | :--- |
| `/cleanup` | Declutter Git branches and completed task folders after work is merged/closed. | Prunes finished task folders & resets pointer when safe |

---

## 🛡️ Critical Guardrails

- **Measure Twice, Cut Once**: Never implement code during scoping or planning. The agent will wait for an explicit `EXECUTE` statement before modifying files.
- **One Source of Truth**: All task state belongs in `.workflow/tasks/[source-id]/WORK.md`. Avoid creating separate `PROBLEM.md` or `PLAN.md` files.
- **Safe Branching**: Triage and planning happen on the main branch. Create the feature branch (`feat/*` or `fix/*`) only when starting `/implement`.

## 📦 Install as a skill bundle

### From GitHub with `npx skills add`

Best for trying or handing off RPIV skills without installing the full `nothing` setup:

```bash
npx -y skills add raquezha/nothing --full-depth -g -a pi \
  -s triage frame grill-with-docs plan implement verify sync cleanup update-docs \
  -y
```

### From npm

```bash
npm install -g @raquezha/norpiv
```

Install the bundled skills for your agent runtime:

```bash
# Pi default: ~/.pi/agent/skills/{triage,frame,plan,...}
norpiv-install

# Other adapters
norpiv-install --target claude
norpiv-install --target codex
norpiv-install --target all
```

Targets:
- `pi` links skills into `~/.pi/agent/skills`.
- `claude` links skills into `~/.claude/skills`.
- `codex` installs the skill docs under `~/.codex/skills/norpiv` and writes an `AGENTS.md` adapter because Codex-style environments do not universally auto-load `SKILL.md` bundles.

`norpiv-install` also installs the shared helper scripts under a sibling `scripts/` directory so skill references like `../scripts/triage_helper.sh` resolve after installation.

## 🚀 Quick Start Example

1. **Activate the RPIV Hat** from the full `nothing` setup:
   ```bash
   pi --rpiv
   ```

   If installed via `npx skills add` or `norpiv-install`, invoke the skills directly in your agent instead.

2. **Triage an Issue**:
   ```text
   /triage github:45
   ```

3. **Frame the Work**:
   ```text
   /frame
   ```

4. **Verify Constraints**:
   ```text
   /grill-with-docs
   ```

5. **Write the Plan Slices**:
   ```text
   /plan
   ```

6. **Authorize Execution**:
   Provide the agent explicit permission to implement:
   ```text
   EXECUTE
   /implement
   ```

7. **Verify & Close**:
   ```text
   /verify
   /sync
   /cleanup
   ```

## 🧭 Shared helper scripts

The bundle includes helper scripts used by the workflow skills:

- `scripts/triage_helper.sh`
- `scripts/validate_active_task.sh`
- `scripts/reposcry-bootstrap.sh`
- `scripts/reposcry-task-context.sh`
- `scripts/reposcry-refresh.sh`

When skills are loaded directly from this package, relative references like `../scripts/...` resolve against the package root. When skills are installed with `norpiv-install`, the same layout is recreated under the target runtime.

## 🔎 Optional RepoScry integration

RepoScry is an optional repo-memory layer for RPIV. norpiv does **not** require it.

If `reposcry` is installed:

```bash
./scripts/reposcry-bootstrap.sh
./scripts/reposcry-task-context.sh "fix dependency graph rebuild"
# edit code
./scripts/reposcry-refresh.sh main
reposcry validate main HEAD
```

Typical usage by phase:

- `/triage`: optionally seed `.reposcry/` with `scripts/reposcry-bootstrap.sh`
- `/frame`: optionally generate `.reposcry/AI_CONTEXT.md` with `scripts/reposcry-task-context.sh`
- `/grill-with-docs`: optionally use `reposcry query_graph`, `get_architecture_overview`, and `get_impact_radius`
- `/implement`: optionally run `scripts/reposcry-refresh.sh` after edit batches
- `/verify`: optionally add `reposcry validate main HEAD` and affected-flow output as extra evidence

If RepoScry is absent, the helpers no-op and RPIV continues with normal repo reading, grep, and tests.

RepoScry guardrails:

- `.reposcry/` is generated local cache and must not be committed.
- `scripts/reposcry-bootstrap.sh` automatically adds `.reposcry/` to the project `.gitignore` before initializing RepoScry.
- If `.reposcry/` is already tracked or staged, bootstrap stops and tells you to remove it from the index.
- `.reposcryignore` is indexing policy, not cache. Review and commit it when you want stable RepoScry behavior across machines.
