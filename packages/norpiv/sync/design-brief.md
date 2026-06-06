# Design Brief: Hardened Tracker Sync (Zero-Trust)

## Skill Type
Workflow skill with supporting scripts for high-reliability tracker interaction.

## Audience/Context
Developers using `pi` for RPIV or task-based implementation, reporting progress to Jira, GitHub, or GitLab.

## Trigger Conditions
- Running `/sync` on a task with source `jira`, `github`, or `gitlab`.
- Running `/verify` or manually requesting a tracker update.

## Inputs
- `WORK.md`: factual state for slices, commits, PR/MR links, and test results.
- Tracker comments/notes API: existing remote status state.
- `<!-- pi-sync-marker -->`: stable marker used to identify Pi-owned living status comments.

## Outputs
- Updated existing Pi marker comment/note when content changed.
- Created new Pi marker comment/note only when no marker exists.
- No action when the existing Pi marker comment/note already matches local state.

## Key Decisions & Heuristics
1. **Marker Over Latest Actor**: Search for the newest comment/note containing `<!-- pi-sync-marker -->`; do not rely on the absolute latest comment. Human replies after Pi must not create infinite Pi comments.
2. **Human Comment Safety**: Only marker-owned Pi comments are mutable. Never edit human-authored comments.
3. **Recursive ADF Parsing**: Jira Cloud uses Atlassian Document Format. The Jira helper must crawl JSON recursively to find marker/signature text.
4. **Identity Comparison**: Normalize whitespace before comparing remote and local bodies to avoid unnecessary updates.
5. **Shell Safety**: Use temporary files and `--body-file`/API body file equivalents where possible to avoid shell length/escaping issues.
6. **Bounded Search**: Jira helper defaults to the newest 50 comments via `PI_SYNC_COMMENT_LIMIT`; increase only when marker comments are older than the default window.

## File Structure
- `sync/SKILL.md`: operational instructions for Jira/GitHub/GitLab.
- `sync/jira_smart_sync.sh`: Jira helper with ADF-aware marker search.

## Success Metrics
- Zero duplicate Pi comments when progress is static.
- Zero new Pi comments when a human replies after an existing Pi status comment.
- Zero overwritten human comments.
- Reliable detection of Pi's living status comment even after Jira ADF conversion.
