# norpiv (Lean RPIV Workflow Engine)

RPIV: a gated workflow for reliable AI coding agents.

RPIV is one implementation of the broader `nothing` Workflow Contract. The contract defines the generic shape for workflows such as RPIV and Research, focusing on 3 Real Modes (Chat, Research, RPIV) tracked by `.workflow/active.json`.

Standalone package usage still works: `@raquezha/norpiv` includes the RPIV skills, `distill`, and helper scripts needed for handoff. The local Research workflow lives separately under `packages/workflows/noresearch`. The platform-level contract lives in the source repo at <https://github.com/raquezha/nothing/blob/main/docs/workflow.md>.

## 🔁 The Lifecycle

The RPIV engine splits task execution into separate, focused phases:

| Phase | Command | Purpose | Input / Output Files |
| :--- | :--- | :--- | :--- |
| **0. Refine (optional)** | `/refine [source]:[id]` | Repair tracker readiness before RPIV when outcome, acceptance criteria, or decomposition are still unclear. | Proposes tracker edits/child work; no `.workflow/` state |
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
| `/post-merge-prune` | Delete stale local branches after a PR/MR is merged, prune remote refs, and clean completed task folders. | Post-merge branch cleanup plus safe task-folder cleanup |

---

## notrace relationship

notrace is an optional retrospective layer around RPIV.

Rules:

- **RPIV must work without notrace**.
- **notrace may attach to RPIV when task state exists**.
- `WORK.md` remains the RPIV source of truth whether notrace is installed or not.
- `.notrace/` owns notrace artifacts.
- `.workflow/` owns RPIV task state.
- notrace artifacts and reviews may be referenced from `WORK.md [LOG]`, but RPIV phases must not depend on those files being present.

## 🛡️ Critical Guardrails

- **Measure Twice, Cut Once**: Never implement code during scoping or planning. The agent will wait for an explicit `EXECUTE` statement before modifying files.
- **One Source of Truth**: All task state belongs in `.workflow/tasks/[source-id]/WORK.md`. Avoid creating separate `PROBLEM.md` or `PLAN.md` files.
- **Safe Branching**: Triage and planning happen on the main branch. Create the feature branch (`feat/*` or `fix/*`) only when starting `/implement`.
- **Canonical Pointer**: `.workflow/active.json` is the active RPIV pointer. Legacy `active_task.json` is compatibility-only during migration.
- **Normalized Intake**: `/triage` writes a small local projection into `WORK.md`; tracker snapshots live in `metadata.json`, not raw CLI dumps.

## 📦 Install as a skill bundle

### From GitHub with `npx skills add`

Best for trying or handing off RPIV skills without installing the full `nothing` setup:

```bash
npx -y skills add raquezha/nothing --full-depth -g -a pi \
  -s refine triage frame grill-with-docs plan implement verify sync post-merge-prune update-docs distill \
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

## 🧢 Hats

| Hat | Purpose |
| :--- | :--- |
| `pi --rpiv` | Full RPIV workflow. Loads refine, triage, frame, grill-with-docs, plan, implement, verify, sync, post-merge-prune, and update-docs. |
| `pi --notes` | Conversation distiller. Saves useful thinking to Obsidian without RPIV ceremony. |

## 📝 Pre-RPIV note capture

### distill

Converts the current conversation into a durable Obsidian-ready markdown note.

**Trigger:** `/distill`, "distill this", "save the useful parts", "save this as a note"

**Output:** A single `.md` file written to `$OBSIDIAN_VAULT/distilled/` or `~/notes/distilled/`

**Use when:** The conversation produced useful thinking that should survive outside chat — an idea, a research thread, a decision, a concept — but is not yet ready for RPIV or a PRD.

**Does not:** Create PRDs, start RPIV, require a ticket, or ask the user to classify their idea.

---

**Relationship to RPIV:**

```text
conversation → /distill → Obsidian note    (pre-commitment)
Obsidian note → /triage → RPIV             (only when ready to commit)
```

`distill` is the missing layer before RPIV. Use `pi --notes` to load it.

Research is a separate local workflow bundle in `packages/workflows/noresearch` and is loaded by the full `nothing` setup with `pi --research`.

## 🚀 Quick Start Example

1. **Activate the RPIV Hat** from the full `nothing` setup:
   ```bash
   pi --rpiv
   ```

   If installed via `npx skills add` or `norpiv-install`, invoke the skills directly in your agent instead.

2. **Optional Tracker Refinement**:
   ```text
   /refine github:45
   ```

3. **Triage an Issue**:
   ```text
   /triage github:45
   ```

4. **Frame the Work**:
   ```text
   /frame
   ```

5. **Verify Constraints**:
   ```text
   /grill-with-docs
   ```

6. **Write the Plan Slices**:
   ```text
   /plan
   ```

7. **Authorize Execution**:
   Provide the agent explicit permission to implement:
   ```text
   EXECUTE
   /implement
   ```

8. **Verify & Close**:
   ```text
   /verify
   /sync
   /post-merge-prune
   ```

## 🧭 Shared helper scripts

The bundle includes helper scripts used by the workflow skills:

- `scripts/triage_helper.sh`
- `scripts/validate_active_task.sh`
- `scripts/graphify-grill.sh`
- `scripts/graphify-grill.py`

When skills are loaded directly from this package, relative references like `../scripts/...` resolve against the package root. When skills are installed with `norpiv-install`, the same layout is recreated under the target runtime.

## 🔎 Optional Graphify grilling

Graphify is an optional grill-only evidence layer for RPIV. norpiv does **not** require it.

If bootstrap provisions `~/.graphify/venv`, `/grill-with-docs` may run:

```bash
./scripts/graphify-grill.sh
```

Guardrails:

- input is a temporary `git archive HEAD` extraction, not the live repository root
- extraction is structural only by default
- Graphify warnings never block grilling; normal source reading remains the fallback
- `INFERRED` or `AMBIGUOUS` edges are leads that still require source verification
