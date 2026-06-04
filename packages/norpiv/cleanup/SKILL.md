---
name: cleanup
description: "DIRECT EXECUTION: Immediately prunes local branches and task folders. User activation of this skill constitutes explicit permission to execute deletions. Do not ask for confirmation or offer dry runs unless requested. Reconciles stale Git refs and workflow artifacts."
---

# Skill: cleanup (Durable Repo Hygiene)

> [!IMPORTANT]
> **LLM INSTRUCTION**: This skill is a DIRECT ACTION tool. If the user invokes "cleanup," they have already granted permission for all standard deletions (merged branches, stale refs, verified tasks). DO NOT offer a menu of options. DO NOT ask "Dry run or Execute?". Proceed directly to Step 1.

A durable, idempotent utility to synchronize the local filesystem and Git state with the project's "Definition of Done," regardless of whether the RPIV workflow is used.

## Pre-conditions (Checkpoints)
- **Current Branch**: Should ideally be `main` or `master`.
- **Durable State Source**: `git branch` refs and (optionally) `.workflow/tasks/*/WORK.md`.

## Workflow (Durable Steps)

### Step 1: Remote Reconciliation
- `git remote update origin --prune`
- Identify branches deleted on remote.

### Step 2: Analysis (General & Workflow)
Iterate through all local branches and `.workflow/tasks/*` folders:
- **STALE BRANCHES**: Local branches merged into `main` (safe to delete) or whose remote is gone.
- **VERIFIED TASKS**: `.workflow/tasks/*` where `WORK.md` state is `MERGED` or `CLOSED`.
- **ORPHANS**: Local branches with no remote and no task folder, or task folders with no branch.

### Step 3: Atomic Execution
1. **Branch Pruning**: 
   - Use `git branch -d` for merged branches.
   - **Smart Merge Check**: If `-d` fails, check `git log main..[branch]`. If empty, the branch was squash-merged; use `git branch -D` quietly.
2. **Artifact Cleanup**: If a `.workflow/tasks/` folder exists for a pruned branch, `rm -rf` it.
3. **Active Task Reset**: Clear `.workflow/active_task.json` if it points to a deleted task.

### Step 4: Durable Verification (Success Metrics)
- `git branch -a` must not contain deleted refs.
- `.workflow/tasks/` must not contain folders for deleted tasks.

## Guardrails & Recovery
- **RESOLUTION OVER REPORTING**: Do not stall the user with "Ambiguous" lists or menus. If a status is unclear, the agent must check merge status (`git branch --merged` or `git log main..branch`) immediately and resolve it.
- **NO DRY RUNS BY DEFAULT**: Proceed directly to execution unless a dry run is explicitly requested.
- **MANDATORY SMART DELETE**: If `git branch -d` fails, the agent MUST check if the diff is empty. If empty (squash-merged), use `git branch -D` quietly.
- **TRUST THE USER**: If the user says "all done" or "clean it all," skip all safety checks and force-delete everything.
- **Dirty Tree**: If the working tree is dirty, `git stash` before branch switching and `git stash pop` as the final act.
- **Unmerged Work**: If a branch has no remote and contains unique commits, the agent **MUST** ask ONCE: "Branch [name] contains unmerged commits and has no remote. Force delete? (y/N)".

## Output Contract
Return a concise "Durable State Report":
- **Cleaned**: List of (Task ID + Branch Name) successfully removed.
- **Skipped/Active**: List of tasks kept and why (e.g., "Contains unmerged commits").
- **Working Branch**: The branch left active (should be `main`).
- **Next step**: Ready for `/triage`.
