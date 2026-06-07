---
name: grill-with-docs
description: Stress-test the active WORK.md brief against docs, code, and domain language. Use after /frame before planning to clarify assumptions and update durable docs only when decisions are stable.
---

# Skill: grill-with-docs

Challenge the brief before planning. This replaces passive ubiquitous-language collection with active clarification.

## Guardrails
- READ: `.workflow/active_task.json`, active `WORK.md` `[BRIEF]`, `CONTEXT.md`, relevant `docs/agents/*`, and `.reposcry/AI_CONTEXT.md` when present.
- WRITE: `WORK.md` -> append to `[GRILL]` and `[LOG]` only; durable docs only when a stable rule is confirmed.
- NEVER: edit `[BRIEF]` silently; propose brief changes if contradictions are found.
- NEVER: plan or implement during grilling.
- NEVER: ask questions the codebase can answer; inspect first.

## Workflow
1. **Context Loading**: Read the active brief, `CONTEXT.md`, relevant `docs/agents/*`, and `.reposcry/AI_CONTEXT.md` when available.
2. **Investigation & Trace**:
   - Locate the files/lines mentioned in the brief.
   - Trace the data flow related to the problem/proposal.
   - Search for "Impact Surface": Who else uses or depends on these components?
3. **Optional RepoScry graph pass**: if `reposcry` is available, use it to ground architecture and blast radius. Before relying on it, ensure the bundled bootstrap/context helper has kept `.reposcry/` ignored and untracked. Use commands such as:
   - `reposcry --repo . get_architecture_overview --format json`
   - `reposcry --repo . query_graph "callers_of <symbol>"`
   - `reposcry --repo . query_graph "tests_for <symbol>"`
   - `reposcry --repo . get_impact_radius <symbol> --depth 4`
   Proceed normally when RepoScry is absent.
4. **Cross-check**: Compare findings against docs, ADRs, and repo patterns.
5. **Relentless Interview**:
   - Ask one question at a time to resolve contradictions or clarify ambiguity.
   - Challenge the brief if the code behaves differently than described.
6. **Log Evidence**: Append resolved decisions, technical findings, edge cases, and constraints to `[GRILL]`.
7. **Log Activity**: Append a timestamped summary of the grilling session to `[LOG]` (Format: `YYYY-MM-DD hh:mm AM/PM`).
8. **Context Curation**: If a durable term/rule emerges, propose or apply a concise `docs/agents/*` update.

## Output contract
End with:
- **Investigation Summary**: (Technical findings & Impact Surface)
- **Resolved decisions**
- **Remaining blockers**
- **Docs updates proposed/applied**
- **Next step**: `/plan` only when the brief is stable and code reality is verified.
