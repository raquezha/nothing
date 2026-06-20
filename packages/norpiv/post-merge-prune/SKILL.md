---
name: post-merge-prune
description: "Post-merge branch cleanup only. Use after a PR/MR is merged and the local feature branch is stale: prune remote refs and delete local branches already merged into the target branch."
---

# Skill: post-merge-prune

> [!IMPORTANT]
> **LLM INSTRUCTION**: This skill is a deliberate post-merge deletion tool. If the user invokes `post-merge-prune`, they want stale local branches removed after merge into the intended target branch. Do not offer a menu of options. Do not ask "Dry run or Execute?". Proceed directly.

Use this skill after a PR/MR has been merged into its intended branch, typically `main`, to remove stale remote-tracking refs and delete the matching local branches because the work is done.

## Goal
- Switch to the intended target branch (`main` by default).
- Prune deleted remote branches.
- Delete local branches that are already merged into the target branch.
- Optionally remove matching workflow task folders.

## Workflow

### Step 1: Go to the target branch
- `git checkout main` (or the intended merge target)
- If the tree is dirty, stash first.

### Step 2: Prune remote-tracking refs
- `git remote update origin --prune`
- This removes local refs for remote branches that were deleted after merge.

### Step 3: Delete merged local branches
Iterate through local branches and delete the ones already merged into the target branch:
- Use `git branch -d <branch>` for normal merges.
- If `-d` refuses but `git log main..[branch]` is empty, the branch was squash-merged; use `git branch -D <branch>`.
- Never delete the active target branch.

### Step 4: Optional workflow cleanup
If a deleted branch has a matching `.workflow/tasks/*` folder, remove it.
If `.workflow/active_task.json` points to a deleted task, clear it.

### Step 5: Verify
- `git branch -a` should no longer show deleted refs.
- `git branch --merged main` should only show branches you intend to keep.
- `.workflow/tasks/` should not contain deleted tasks.

## Guardrails
- **RESOLUTION OVER REPORTING**: If merge status is unclear, check `git branch --merged main` or `git log main..branch` and resolve it.
- **NO DRY RUNS BY DEFAULT**: Execute the cleanup unless the user explicitly asks for a preview.
- **SMART DELETE**: If a branch is squash-merged, delete it with `git branch -D` after confirming there are no unique commits left.
- **ACTIVE BRANCH PROTECTION**: Do not delete the current branch.
- **UNMERGED WORK**: If a branch has unique commits and no remote, ask once before force-deleting.

## Output Contract
Return a concise report:
- **Cleaned**: deleted branches / task folders
- **Kept**: branches still in use
- **Working Branch**: the branch left checked out (should be `main`)
