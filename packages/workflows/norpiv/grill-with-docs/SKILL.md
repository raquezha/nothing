---
name: grill-with-docs
workflow: rpiv
workflowPhase: grill-with-docs
description: Stress-test the active WORK.md brief against docs, code, and domain language. Use after /frame before planning to clarify assumptions and update durable docs only when decisions are stable.
---

# Skill: grill-with-docs

Challenge the brief before planning. This replaces passive ubiquitous-language collection with active clarification.

## Guardrails
- READ: `.workflow/active.json` first, then legacy compatibility `.workflow/active_task.json` only if needed, plus active `WORK.md` `[BRIEF]`, `CONTEXT.md`, and relevant `docs/agents/*`.
- WRITE: `WORK.md` -> append to `[GRILL]` and `[LOG]` only; durable docs only when a stable rule is confirmed.
- NEVER: edit `[BRIEF]` silently; propose brief changes if contradictions are found.
- NEVER: plan or implement during grilling.
- NEVER: ask questions the codebase can answer; inspect first.
- EVIDENCE ISOLATION: Resolve task evidence from `.workflow/tasks/<task-id>/evidence/` or explicit active state references. Do not substitute arbitrary repository-root files as task evidence.

## Workflow
1. **Context Loading**: Read the active brief, `CONTEXT.md`, and relevant `docs/agents/*`.
2. **Investigation & Trace**:
   - Locate the files/lines mentioned in the brief.
   - Trace the data flow related to the problem/proposal.
   - Search for "Impact Surface": Who else uses or depends on these components?
3. **Optional Graphify pass**: run `../scripts/graphify-grill.sh` once for bounded structural evidence. It reads only a temporary `git archive HEAD` extraction and warns instead of failing when unavailable. Treat `INFERRED` or `AMBIGUOUS` edges as leads: verify them in source before recording conclusions.
4. **Cross-check & Evidence Verification**:
   - Compare findings against docs, ADRs, and repo patterns.
   - **Evaluate Evidence Classification**: Check evidence status (`present`, `missing`, `n/a`).
   - For `UI-sensitive` work: Verify the source ticket explicitly contains a direct Zeplin screen URL (`https://zpl.io/<id>` or `*.zeplin.io/.../screen/...`) or direct Figma screen/frame URL (`https://figma.com/design/...` with `node-id`). Reject attachments, screenshots, generic design links, and links present only on parent/linked tickets as direct evidence. If design links are discovered on parent/linked tickets, report them in `[GRILL]` as diagnostic context to help repair the ticket, but record evidence status as `missing`.
   - For `Formula-sensitive` work: Verify explicit formula specifications or truth tables are on the ticket; if absent, record evidence status as `missing`.
   - For `Backend-safe` work: Evidence status is `n/a`.
5. **Challenge**: record confirmed constraints, challenged assumptions, chosen decisions, open blockers / HITL questions, and risks handed to `/plan` or `/implement`.
6. **Interview**: ask one question at a time only for execution-blocking ambiguity the repository cannot answer.
7. **Log Evidence**: Append resolved decisions, technical findings, edge cases, and constraints to `[GRILL]`.
8. **Log Activity**: Append a timestamped summary of the grilling session to `[LOG]` (Format: `YYYY-MM-DD hh:mm AM/PM`).
9. **Context Curation**: If a durable term/rule emerges, propose or apply a concise `docs/agents/*` update.

## Output contract
End with:
- **Investigation Summary**: (Technical findings & Impact Surface)
- **Resolved decisions**
- **Remaining blockers**
- **Docs updates proposed/applied**
- **Next step**: `/plan` only when the brief is stable and code reality is verified.
