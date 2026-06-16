---
name: sync
workflow: rpiv
workflowPhase: sync
description: Synchronizes local RPIV task state (WORK.md) to external trackers (Jira, GitHub, GitLab). Use this to publish progress, update implementation status, and maintain a durable audit trail between local development and remote project management tools.
---

# Skill: sync

Maintains consistency between local `.workflow` state and the remote source of truth using a single Pi-owned living status comment per task.

## Guardrails
- **Pre-flight**: Always read `.workflow/active_workflow.json` / `.workflow/active_task.json` and the active `WORK.md` before executing.
- **Privacy**: NEVER sync secrets, environment variables, or private notes not intended for stakeholders.
- **Integrity**: Do not modify `[BRIEF]` or `[GRILL]` sections.
- **Idempotency**: If the remote Pi status already reflects the current local state, do not post or update.
- **Human safety**: NEVER edit human-authored comments. Only update comments/notes containing the Pi sync marker.

## Living status marker
Every sync body MUST include this marker at the end:

```md
<!-- pi-sync-marker -->
```

Also include the human-readable signature:

```md
🤖 *Synced by pi (AI assistant) on behalf of the developer.*
```

The marker identifies the mutable Pi-owned status comment. Human comments after the Pi status must not force new Pi comments.

## Decision Logic (Find / No-op / Update / Create)
To keep remote history clean, use this hierarchy for Jira, GitHub, and GitLab:

1. Render the new sync body from local `WORK.md`.
2. Fetch existing comments/notes for the remote issue, PR, or MR.
3. Search for the newest comment/note containing `<!-- pi-sync-marker -->`.
4. If a marker comment exists and normalized body is identical: **NO-OP**.
5. If a marker comment exists and body differs: **UPDATE** that marker comment/note.
6. If no marker comment exists: **CREATE** one new Pi status comment/note.

Do **not** use latest-comment ownership as the primary decision. Latest-comment-only logic causes infinite comment spam when humans reply after Pi.

## Workflow

### 1. Discovery & State Loading
- Identify the platform and ID from `.workflow/active_workflow.json` or compatibility `.workflow/active_task.json`.
- Extract **Slices** from `[PLAN]`, **Status** from `[LOG]`, and **Artifacts** such as PR/MR links, commit hashes, and verification output.

### 2. Payload Preparation
Format the message for two audiences:
- **Stakeholders**: summarize outcome, current state, and next step.
- **Developers**: list vertical slices, commit/PR/MR links, and verification evidence.
- **Signature and marker**: always append both the signature and `<!-- pi-sync-marker -->`.

### 3. Execution

#### Jira
Use the helper so ADF parsing and marker search stay centralized:

```bash
cat body.md | <skill_location>/jira_smart_sync.sh <ISSUE_ID>
```

Behavior:
- fetch recent comments newest-first, default limit `50`
- override limit with `PI_SYNC_COMMENT_LIMIT=<n>` if needed
- find newest marker comment anywhere in the fetched window
- update marker comment by ID, no-op if identical, create only if no marker exists

#### GitHub Issues / PRs
Use the issue comments API. PR comments use issue comments for PR body discussion.

Check:
```bash
gh api repos/:owner/:repo/issues/<id>/comments --paginate \
  --jq 'map(select(.body | contains("<!-- pi-sync-marker -->"))) | last'
```

Update:
```bash
gh api -X PATCH repos/:owner/:repo/issues/comments/<comment_id> \
  -f body=@body.md
```

Create:
```bash
gh issue comment <id> --body-file body.md
```

Rules:
- update only a comment containing the marker
- no-op when normalized body is already current
- create only when no marker comment exists

#### GitLab Issues / MRs
Use notes API for issues or merge requests.

Check MR notes:
```bash
glab api projects/:id/merge_requests/<iid>/notes --paginate \
  --jq 'map(select(.body | contains("<!-- pi-sync-marker -->"))) | last'
```

Update MR note:
```bash
glab api -X PUT projects/:id/merge_requests/<iid>/notes/<note_id> \
  -f body=@body.md
```

Create MR note:
```bash
glab mr note <iid> --message "$(cat body.md)"
```

Rules:
- update only a note containing the marker
- no-op when normalized body is already current
- create only when no marker note exists

### 4. Local Confirmation
- Append a timestamped sync record to `WORK.md` `[LOG]` with action: `no-op`, `updated`, or `created`.
- Do not edit `[BRIEF]` or `[GRILL]`.

## Output Contract
Return a concise summary:
- **Target**: platform and issue/PR/MR ID
- **Action**: no-op / updated existing status / created new status
- **Reason**: marker found, body identical, marker missing, etc.
- **Link**: remote comment/note URL if available
- **Next step**: review, verify, cleanup, or continue implementation
