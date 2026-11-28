---
name: plan
workflow: rpiv
workflowPhase: plan
description: Create or revise vertical implementation slices in the active WORK.md. Use after /grill-with-docs to produce a concise, reviewable plan for implementation.
---

# Skill: plan

Map the "how" into tracer-bullet vertical slices.

## Guardrails
- READ: `.workflow/active.json` / `.workflow/active_task.json` then active `WORK.md` `[BRIEF]` and `[GRILL]`.
- WRITE: `WORK.md` -> `[PLAN]` and append to `[LOG]` only.
- NEVER: implement code during planning.
- NEVER: create standalone `PLAN.md`.
- NEVER: ask whether to plan if the user invoked `/plan`; produce the plan.
- EVIDENCE BLOCKING GATE: If task evidence status is `missing` for `UI-sensitive` or `Formula-sensitive` work, `/plan` MUST flag dependent slices as `[BLOCKED: missing UI/formula evidence]` and preserve blocked status instead of marking slices ready for implementation.
- AUTOMATIC NODESIGN PREFLIGHT: For `UI-sensitive` work, `/plan` MUST automatically consume or run NoDesign preflight (`nodesign preflight --json --path . --task <source>:<id>`; fallback `npx --yes @raquezha/nodesign preflight --json --path . --task <source>:<id>` if `nodesign` is not on PATH) without requiring manual preflight CLI execution.
- EVIDENCEMAPPING: Map NoDesign preflight evidence status to RPIV evidence status: `ready` -> `present`, `missing` or `ambiguous` -> `missing`.
- PROVIDER FAULT ISOLATION: Distinguish provider auth/access failures (`AUTH_REQUIRED`, `AUTH_REJECTED`, `ACCESS_DENIED`, `RATE_LIMITED`, `API_UNAVAILABLE`) from missing design evidence truth (`DESIGN_NOT_FOUND`, missing direct `node-id` / screen URL). Surface missing credentials or API access cleanly without treating provider auth errors as product specification failure.
- CREDENTIAL SAFETY: Never request or pass NoDesign API tokens through model context; resolve credentials from OS keychain, environment variables, or `~/.pi-secrets/.env`.
- HUMAN WAIVER: Allow explicit human waivers (recorded distinctly as `waived: <reason>` in `WORK.md`). Human waivers unblock implementation-ready planning while preserving explicit waiver audit state.
- EVIDENCE ISOLATION: Resolve task evidence from active workspace `.workflow/tasks/<task-id>/evidence/` or task state. Do not scan arbitrary repository files as task evidence.
- INVARIANT & REGRESSION GATE: `/plan` MUST explicitly identify system and domain invariants that must remain unbroken (contracts, state machines, backwards compatibility) and map the blast radius (affected callers, consumers, shared dependencies). Every slice MUST define both functional verification and negative/regression checks so plans do not require follow-up prompts to check for regressions or broken invariants.

## Workflow
1. Read the brief and grill decisions.
2. **Automatic NoDesign Preflight (UI-sensitive)**: If evidence category is `UI-sensitive`, invoke or consume `nodesign preflight --json --path . --task <source>:<id>` (or `npx --yes @raquezha/nodesign preflight --json --path . --task <source>:<id>` when the binary is unavailable). Map `ready` status to `present`, and `missing` or `ambiguous` to `missing`. If credentials or provider access are missing (`AUTH_REQUIRED`, `ACCESS_DENIED`), surface the provider issue explicitly instead of mistaking it for a missing product design URL.
3. **Branch Check**: Verify the current git branch. Planning on `main` is safe and encouraged. If you are on an unrelated feature branch, warn the human that the plan is being made on a stale or mismatched context.
4. **Invariant & Blast Radius Mapping**:
   - Identify domain and system invariants that must NOT break.
   - Map affected callers, consumers, shared utilities, and existing test suites (blast radius).
5. **Draft thin vertical slices**:
   - Each slice must be independently verifiable.
   - Include both positive functional verification and negative/regression checks per slice.
6. **Mark each slice**:
   - **AFK**: agent can implement with clear checks.
   - **HITL**: human judgment, product decision, external access, or manual review required.
7. **Include dependencies and verification command(s)** (positive and regression) per slice.
8. **Write the plan into `[PLAN]`** with:
   - `- **Preserved Invariants**:` bullet list
   - `- **Blast Radius & Regressions**:` bullet list
   - Slices with checkboxes. If evidence status is `missing`, mark the slice as `[BLOCKED: missing UI/formula evidence]` and explain what is needed (direct Zeplin `https://zpl.io/<id>` screen URL, direct Figma `node-id` frame URL, or formula spec).
9. **Log Activity**: Append a timestamped entry to `[LOG]` summarizing the plan or revision (Format: `YYYY-MM-DD hh:mm AM/PM`).
10. Recommend `/sync` if the task has a tracker, then `/implement`.

## Output contract
End with:
- **Preserved Invariants**
- **Blast Radius & Regressions**
- **Slices**: count and names
- **AFK/HITL split**
- **Verification commands**: positive and regression commands
- **Next step**: `/sync` or `/implement`
