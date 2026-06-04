# norpiv (Lean RPIV Workflow Engine)

A disciplined task execution lifecycle for the Pi coding agent designed to maximize accuracy, control, and traceability through a step-by-step Staff Engineer planning process.

## 🔁 The Lifecycle

The RPIV engine splits task execution into separate, focused phases:

| Phase | Command | Purpose | Input / Output Files |
| :--- | :--- | :--- | :--- |
| **1. Ingest** | `/triage [source]:[id]` | Initial task verification and workspace setup. | Creates `.workflow/tasks/[id]/WORK.md` & `metadata.json` |
| **2. Scoping** | `/frame` | Author a clear, structured task brief. | Populates `WORK.md` ➔ `[BRIEF]` section |
| **3. Interrogate**| `/grill-with-docs` | Stress-test brief against rules and docs. | Records decisions in `WORK.md` ➔ `[GRILL]` |
| **4. Strategy** | `/plan` | Draft thin, independently testable slices. | Writes checkbox items in `WORK.md` ➔ `[PLAN]` |
| **5. Coding** | `/implement` | Execute one approved plan slice (needs permission). | Modifies code; records updates in `WORK.md` ➔ `[LOG]` |
| **6. Truth Test** | `/verify` | Run tests, lint, and verify quality. | Appends results to `[LOG]` |
| **7. Close** | `/sync` | Bridge local progress with external trackers. | Posts summary updates to Jira, GitHub, or GitLab |
| **8. Housekeep** | `/cleanup` | Declutter Git branches and active tasks. | Safely prunes finished task folders & resets pointer |

---

## 🛡️ Critical Guardrails

- **Measure Twice, Cut Once**: Never implement code during scoping or planning. The agent will wait for an explicit `EXECUTE` statement before modifying files.
- **One Source of Truth**: All task state belongs in `.workflow/tasks/[source-id]/WORK.md`. Avoid creating separate `PROBLEM.md` or `PLAN.md` files.
- **Safe Branching**: Triage and planning happen on the main branch. Create the feature branch (`feat/*` or `fix/*`) only when starting `/implement`.

## 🚀 Quick Start Example

1. **Activate the RPIV Hat**:
   ```bash
   pi --rpiv
   ```

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
