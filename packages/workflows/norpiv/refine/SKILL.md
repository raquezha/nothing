---
name: refine
workflow: pre-rpiv
workflowPhase: refine
description: Repair tracker work-item readiness before RPIV intake. Use for jira:, github:, or gitlab: items that still need clarified outcome, acceptance criteria, or child work before /triage.
---

# Skill: refine

Make a tracker item ready for engineering handoff without inventing product decisions.

## Guardrails
- READ: tracker item, linked/child work, relevant comments, and targeted repo context only when needed for ownership or feasibility.
- WRITE: proposals in chat first; tracker comments/field edits/child creation only after explicit human approval.
- NEVER: implement code, create branches, or start RPIV task state.
- NEVER: invent missing product intent when a human decision is required.
- NEVER: duplicate existing child work or spam repeated agent comments.
- NEVER: move work across trackers.

## Workflow
1. Parse namespaced source: `jira:KEY`, `github:ID`, or `gitlab:ID`.
2. Read the item, current structure, and recent comments.
3. Classify readiness gaps: missing outcome, acceptance criteria, ownership, dependencies, blockers, or decomposition.
4. Return one outcome:
   - `ready-single`
   - `ready-decomposed`
   - `needs-decision`
5. Propose the smallest useful tracker edits and child items before mutating anything.
6. On explicit approval, apply the approved tracker edits only.
7. Re-run idempotently: reuse existing child items and any prior agent-owned refinement marker/comment.
8. Recommend `/triage` only once the item is execution-ready.

## Output contract
End with:
- **Outcome**: ready-single / ready-decomposed / needs-decision
- **Missing information**
- **Proposed tracker edits**
- **Proposed child work**
- **Next step**: approve edits / answer question / `/triage`
