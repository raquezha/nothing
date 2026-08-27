---
name: sync
workflow: rpiv
workflowPhase: sync
description: Synchronizes local RPIV task state (WORK.md) to external trackers (Jira, GitHub, GitLab). Use this to publish progress, update implementation status, and maintain a durable audit trail between local development and remote project management tools.
---

# Skill: sync

Maintains consistency between local `.workflow` state and external remote trackers (Jira, GitHub, GitLab) across primary tasks and all related items (parents, sub-issues, mentioned items, linked PRs/MRs).

## Guardrails
- **Pre-flight**: Always read `.workflow/active.json` first, then compatibility `.workflow/active_task.json` only if needed, and the active `WORK.md` before executing.
- **Context-First Verification (100% Certainty Rule)**: Read the primary issue and trace all related issues (parents, sub-issues, mentioned issues `#123`, linked PRs/MRs) BEFORE executing remote mutations. Gather full context first and only update descriptions, tick checkboxes, or change issue statuses when 100% certain based on verified code and test evidence.
- **Universal Multi-Issue Sync**: Regardless of platform (Jira, GitHub, GitLab), evaluate and update all related items in the task tree:
  - **Primary Child Item**: Update description checkboxes (`- [x]`), post/update living status comment (`<!-- pi-sync-marker -->`), and close/transition to Done/Closed when work and acceptance criteria are complete.
  - **Parent / Track Item**: Update parent track descriptions to tick off child issue progress (e.g. `- [x] #174 ...`) and parent acceptance criteria. Keep umbrella parent issues open for high-level tracking unless all child items are complete.
  - **Mentioned / Linked Items**: Inspect mentioned or linked items (`Refs #123`, `Fixes #123`, sub-tasks) and update their checkboxes and status when verified.
- **Privacy**: NEVER sync secrets, environment variables, or private notes not intended for stakeholders.
- **Integrity**: Do not modify `[BRIEF]` or `[GRILL]` sections in local `WORK.md`.
- **Idempotency**: If remote descriptions, statuses, and Pi status comments already reflect current local state, do not post duplicate comments or redundant updates.
- **Human Safety**: NEVER edit human-authored comments. Only update status comments containing `<!-- pi-sync-marker -->`.
- **Hyperlinks**: Format issue references (e.g. `[#140](https://github.com/owner/repo/issues/140)`), file paths, git branches, commit hashes (`[\`35bd81b\`](url)`), and PR/MR links as explicit Markdown hyperlinks in sync comments whenever applicable.
- **Shell Safety**: Never pass markdown bodies inline through shell strings. Write bodies to files and use `--body-file` or JSON `--input` API calls so backticks and `$()` cannot execute.

## Living status marker
Every sync status comment MUST include this marker at the end:

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

### 1. Context Gathering & Traversal (Read-First Protocol)
- Identify primary task platform and ID from `.workflow/active.json` / `WORK.md`.
- **Fetch Primary Item**: Read primary issue details (title, body, state, acceptance criteria, labels).
- **Trace Related Graph**:
  - **GitHub**: Fetch parent issue (`gh issue view <id> --json parent,subIssues`), mentioned issues in `WORK.md` intake/brief (e.g. `Parent track: #166`, `Refs #174`), and linked PRs (`gh issue view <id> --json closingPRs`).
  - **Jira**: Fetch parent epic, sub-tasks, linked issues, and issue links (`jira issue view <id>`).
  - **GitLab**: Fetch parent epic, child issues, related merge requests (`glab issue view <id>`).
- **Verify Evidence**: Confirm test runs, commit hashes, merged PRs/MRs, and acceptance criteria in `WORK.md`.

### 2. Multi-Item Update Strategy (100% Certainty Check)
Only proceed with remote mutations after confirming complete context:
- **Descriptions & Checkboxes**:
  - Update primary issue body to tick completed acceptance criteria (`- [x]`).
  - Update parent track body to tick completed child track items (`- [x] #174 ...`).
  - Use JSON payload `--input` or `--body-file` to safely update issue descriptions without escaping errors.
- **Status & Transitions**:
  - Close/transition executable child items to `Closed` / `Done` after PR merge and acceptance criteria verification.
  - Preserve umbrella parent issues as `Open` until all child items in the track are complete.
- **Living Status Comment**:
  - Prepare and publish/update the living status comment with `<!-- pi-sync-marker -->` on the primary task item (and parent item if requested).

### 3. Execution Helpers by Platform

#### Jira
Use the centralized smart sync helper for status comments:

```bash
cat body.md | <skill_location>/jira_smart_sync.sh <ISSUE_ID>
```

For issue description/checkbox and status updates:
- Update description: use `acli` or Jira REST API with JSON body payload.
- Transition status: `acli transitionIssue --issue <ID> --step "Done"` or API transition.

#### GitHub Issues / PRs
- **Fetch Related Context**:
  ```bash
  gh issue view <id> --json parent,subIssues,body,state
  ```
- **Update Description (Checkboxes)**:
  ```bash
  jq -n --rawfile body updated_issue_body.md '{body: $body}' > update_payload.json
  gh api -X PATCH repos/:owner/:repo/issues/<id> --input update_payload.json
  ```
- **Update Status Comment**:
  Check:
  ```bash
  gh api repos/:owner/:repo/issues/<id>/comments --paginate \
    --jq 'map(select(.body | contains("<!-- pi-sync-marker -->"))) | last'
  ```
  Update existing comment:
  ```bash
  jq -n --rawfile body comment_body.md '{body: $body}' > comment_payload.json
  gh api -X PATCH repos/:owner/:repo/issues/comments/<comment_id> --input comment_payload.json
  ```
  Create comment if missing:
  ```bash
  gh issue comment <id> --body-file comment_body.md
  ```
- **Close Executable Child Issue**:
  ```bash
  gh issue close <id> --comment "Completed and verified in PR #<pr_number>."
  ```

#### GitLab Issues / MRs
- **Fetch Context**:
  ```bash
  glab issue view <id>
  ```
- **Update Description & Status**:
  ```bash
  glab issue update <id> --description "$(cat updated_body.md)"
  glab issue close <id>
  ```
- **Update Status Note**:
  ```bash
  glab api -X PUT projects/:id/issues/<id>/notes/<note_id> -f body=@comment_body.md
  ```

### 4. Local Confirmation & Logging
- Append a timestamped sync entry to `WORK.md` `[LOG]` recording:
  - Primary target updated (description checkboxes, status comment, closed/transitioned).
  - Related items updated (parent track checkboxes, sub-issue statuses).
  - Explicit URLs for status comments and PRs/MRs.
- Preserve guarded `[BRIEF]` and `[GRILL]` sections untouched.

## Output Contract
Return a concise summary:
- **Primary Target**: platform and issue ID, status transition (e.g. `Closed`), description checkboxes updated.
- **Related Items Updated**: list of parent tracks (`#166`), sub-issues, or mentioned issues updated (`- [x] #174`).
- **Living Status Comment**: `no-op` / `updated` / `created` with remote comment URL.
- **Next Step**: review, post-merge-prune, or proceed to next RPIV task.
