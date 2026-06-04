---
name: sync
description: Synchronizes local RPIV task state (WORK.md) to external trackers (Jira, GitHub, GitLab). Use this to publish progress, update implementation status, and maintain a durable audit trail between local development and remote project management tools.
---

# Skill: sync

Maintains consistency between the local `.workflow` state and the remote source of truth. It implements a "Smart Sync" strategy to maximize visibility while minimizing notification noise.

## Guardrails
- **Pre-flight**: Always read `.workflow/active_task.json` and the active `WORK.md` before executing.
- **Privacy**: NEVER sync secrets, environment variables, or private notes not intended for stakeholders.
- **Integrity**: Do not modify `[BRIEF]` or `[GRILL]` sections.
- **Idempotency**: If the remote state already reflects the current local state, do not post a duplicate comment.

## Decision Logic (Update vs. Create)
To keep the remote history clean, follow this hierarchy:
1. **Check Latest Actor**: Fetch the most recent comment/note on the remote issue/PR.
2. **If latest actor is NOT Pi**: Always **CREATE** a new comment to avoid interrupting human discussion.
3. **If latest actor IS Pi**:
   - Compare **Vertical Slices**:
     - If Slices are **Identical**: **UPDATE** the existing comment (it's a minor progress update).
     - If Slices have **Changed**: **CREATE** a new comment (it's a new implementation phase).

## Workflow

### 1. Discovery & State Loading
- Identify the platform and ID from `.workflow/active_task.json`.
- Extract **Slices** (from `[PLAN]`), **Status** (from `[LOG]`), and **Artifacts** (PR links/hashes).

### 2. Payload Preparation
Format the message for two audiences:
- **Stakeholders**: Summarize "The Fix" and "The Result".
- **Developers**: List "Vertical Slices", "Commit/MR", and "Test Results".
- **Signature**: Always append: 
  `🤖 *Synced by pi (AI assistant) on behalf of the developer.*`
  `<!-- pi-sync-marker -->`

### 3. Execution
- **Jira**: Execute `./pi/skills/norpiv/sync/jira_smart_sync.sh <ISSUE_ID>`. This script handles the ADF format and smart logic.
- **GitHub**:
  - `Check`: `gh issue/pr view <id> --json comments --jq '.comments[-1]'`
  - `Action`: If `.body` contains marker AND slices match, `gh api -X PATCH ...`. Else `gh issue/pr comment ...`.
- **GitLab**:
  - `Check`: `glab api projects/:id/merge_requests/:iid/notes --jq 'sort_by(.created_at) | last'`
  - `Action`: If `.body` contains marker AND slices match, `glab api -X PUT ...`. Else `glab mr note ...`.

### 4. Local Confirmation
- Append a timestamped sync record to `WORK.md` `[LOG]` (Format: `YYYY-MM-DD hh:mm AM/PM`).

## Output Contract
Return a concise summary:
- **Target**: Platform and Issue/PR ID.
- **Action**: [Updated existing comment] OR [Created new comment].
- **Reason**: (e.g., "Matched previous slices", "Human replied", "New work phase").
- **Link**: URL to the remote comment if available.
