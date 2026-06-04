---
name: grill-with-docs
description: Stress-test the active WORK.md brief against docs, code, and domain language. Use after /frame before planning to clarify assumptions and update durable docs only when decisions are stable.
---

# Skill: grill-with-docs

Challenge the brief before planning. This replaces passive ubiquitous-language collection with active clarification.

## Guardrails
- READ: `.workflow/active_task.json`, active `WORK.md` `[BRIEF]`, `CONTEXT.md`, and relevant `docs/agents/*`.
- WRITE: `WORK.md` -> append to `[GRILL]` and `[LOG]` only; durable docs only when a stable rule is confirmed.
- NEVER: edit `[BRIEF]` silently; propose brief changes if contradictions are found.
- NEVER: plan or implement during grilling.
- NEVER: ask questions the codebase can answer; inspect first.

## Workflow
1. **Context Loading**: Read the active brief, `CONTEXT.md`, and relevant `docs/agents/*`.
2. **Investigation & Trace**:
   - Locate the files/lines mentioned in the brief.
   - Trace the data flow related to the problem/proposal.
   - Search for "Impact Surface": Who else uses or depends on these components?
3. **Cross-check**: Compare findings against docs, ADRs, and repo patterns.
4. **Relentless Interview**: 
   - Ask one question at a time to resolve contradictions or clarify ambiguity.
   - Challenge the brief if the code behaves differently than described.
5. **Log Evidence**: Append resolved decisions, technical findings, edge cases, and constraints to `[GRILL]`.
6. **Log Activity**: Append a timestamped summary of the grilling session to `[LOG]` (Format: `YYYY-MM-DD hh:mm AM/PM`).
7. **Context Curation**: If a durable term/rule emerges, propose or apply a concise `docs/agents/*` update.

## Output contract
End with:
- **Investigation Summary**: (Technical findings & Impact Surface)
- **Resolved decisions**
- **Remaining blockers**
- **Docs updates proposed/applied**
- **Next step**: `/plan` only when the brief is stable and code reality is verified.
