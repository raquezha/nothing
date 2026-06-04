# Design Brief: Hardened Jira Sync (Zero-Trust)

## Skill Type
Workflow skill with supporting script for high-reliability interaction.

## Audience/Context
Developers using `pi` for RPIV or task-based implementation, reporting progress to Jira Cloud via Atlassian's official CLI (`acli`).

## Trigger Conditions
- Running `/sync` on a task where the source is `jira`.
- Running `/verify` or manually requesting a tracker update.

## Inputs
- `WORK.md`: For the factual state (Slices, Commits, Test results).
- `acli jira workitem comment list`: For existing tracker state (JSON).
- `PI_SIGNATURE`: The constant used to identify Pi-owned comments.

## Outputs
- Updated existing comment via `acli jira workitem comment update` (if the latest comment is Pi's and content changed).
- New comment via `acli jira workitem comment create` (if the latest comment is human-owned or no Pi comment exists).
- No action (if progress is identical to the existing Pi comment).

## Key Decisions & Heuristics
1. **Always Check Absolute Latest**: Never update if a human has commented since the last sync. Overwriting conversation is "being a piece of shit."
2. **Recursive ADF Parsing**: Jira Cloud uses Atlassian Document Format. The script must crawl the JSON recursively to find the signature.
3. **Identity Comparison**: Convert new body to ADF (or plain text) and compare with existing to avoid "Notification Spam."
4. **Shell Safety**: Use temporary files and `--body-file` to avoid shell length/escaping issues.

## File Structure
- `pi/skills/norpiv/sync/SKILL.md`: Operational instructions.
- `pi/skills/norpiv/sync/jira_smart_sync.sh`: Hardened implementation script.

## Success Metric
- Zero duplicate Pi comments when progress is static.
- Zero overwritten human comments.
- Reliable detection of Pi's "Living Progress" comment even after Jira ADF conversion.
