---
name: refine
workflow: pre-rpiv
workflowPhase: refine
description: "Repair tracker work-item readiness before RPIV intake. Use for jira:, github:, or gitlab: items that still need clarified outcome, acceptance criteria, or child work before /triage."
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
4. For every proposed child item, state intended owner, confidence, and fallback `unassigned`. Auto-assign only when the signal is strong from the tracker, comments, or existing team ownership patterns.
5. Decide dependency handling explicitly for each child pair or blocker:
   - no dependency
   - description note only
   - real tracker link
   Prefer actual Jira `Blocks` links when child A must precede child B.
6. Return one outcome:
   - `ready-single`: one executable owner, no decomposition needed
   - `ready-decomposed`: split is needed and children, links, and owners are clear
   - `needs-decision`: missing product decision or not truly ready-decomposed because ownership/dependencies are still muddy
7. Propose the smallest useful tracker edits and child items before mutating anything.
8. Before any approved mutation, walk this checklist in order:
   - preserve product-authored text
   - append acceptance criteria instead of rewriting existing acceptance criteria
   - create child?
   - assign child?
   - link child?
   - then mutate parent text/fields
9. On explicit approval, apply the approved tracker edits only.
10. Re-run idempotently: reuse existing child items and any prior agent-owned refinement marker/comment.
11. Recommend `/triage` only once the item is execution-ready.

## Output contract
End with:
- **Outcome**: ready-single / ready-decomposed / needs-decision
- **Missing information**
- **Proposed tracker edits**
- **Proposed child work**
- **Proposed ownership**
- **Proposed dependency links**
- **Next step**: approve edits / answer question / `/triage`
