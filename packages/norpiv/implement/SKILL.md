---
name: implement
description: Implement the next approved vertical slice from the active WORK.md and prepare a Draft PR/MR. Use when the plan is approved and the user explicitly asks to implement.
---

# Skill: implement

Execute one functional vertical slice and hand it to the human for review.

## Guardrails
- READ: `.workflow/active_task.json` then active `WORK.md` `[PLAN]`, `[BRIEF]`, and relevant `[LOG]` evidence.
- WRITE: code changes and `WORK.md` -> append to `[LOG]` only; optional `.reposcry/` cache refresh when RepoScry is installed.
- NEVER: edit `[BRIEF]` or `[GRILL]`.
- NEVER: implement without explicit user instruction.
- NEVER: commit a Jira-tracked task with a Jira-less subject; if the active task source is `jira`, the commit subject MUST include the Jira key from `.workflow/active_task.json` (e.g. `fix(PROJ-123): ...`).
- NEVER: hide the Jira key only in the commit body/footer when the task is Jira-tracked; the subject itself must carry the key.
- NEVER: add `Signed-off-by`; only the human can certify DCO.
- NEVER: freestyle PR/MR descriptions; use the Draft PR/MR body contract below.

## Workflow
1. Identify the first approved unchecked slice in `[PLAN]`.
2. Move tracked task to **In Progress** only when implementation actually starts.
3. **Mandatory Branch Check**: You MUST run the branch enforcement script before modifying any code.
   - Use the absolute path if possible: `<skill_location>/scripts/enforce-branch.sh`.
   - This script prevents accidental implementation on `main`/`master`.
   - If the script switches branches, you must update the `[META]` section of `WORK.md` to reflect the new branch name.
   - If the script fails, STOP and ask the human for help. Do not proceed with code changes.
4. Optional RepoScry blast-radius pass: if `reposcry` is available, inspect impact before wide edits (`reposcry --repo . get_impact_radius <symbol> --depth 4` or related graph queries). Continue normally when RepoScry is absent.
5. Implement test-first where practical; otherwise document why not in `[LOG]`.
6. After each edit batch, if the bundled `../scripts/reposcry-refresh.sh` helper is present and `reposcry-update` is installed, run it. RepoScry refresh failure should not block implementation. Never stage or commit `.reposcry/`; it is generated cache. `.reposcryignore` may be committed only after review as indexing policy.
7. Run the slice verification command and available quality gates.
8. Commit with a Conventional Commit header and `Assisted-by: [AGENT]:[MODEL] [tools]` footer (populating the agent name and model ID from the current session context).
   - For Jira-tracked tasks, the header MUST include the Jira key in the scope position: `fix(PROJ-123): ...` or `feat(PROJ-123): ...`.
   - If release-note tooling also needs the key in parsed text, add `Refs: PROJ-123` in the body/footer as well.
9. Push and open a Draft PR/MR with `gh` or `glab` when a remote exists.
   - For Jira-tracked tasks, the PR/MR title MUST also include the Jira key and should mirror the commit subject.
10. Use a temporary body file (`--body-file` or API equivalent) for PR/MR descriptions to avoid shell quoting and markdown escaping bugs.
11. Append summary, commit hash, and PR/MR link to `[LOG]` (Format: `YYYY-MM-DD hh:mm AM/PM`).

## Draft PR/MR body contract

Generate the Draft PR/MR body from the active `WORK.md`, implemented slice, commit(s), and verification evidence. If a section has no evidence yet, say so explicitly; do not omit the section.

Use this exact section order:

```md
## Summary
- <one to three bullets describing what changed and why>

## Scope
- <files/areas changed>
- <notable behavior or workflow changes>

## Verification
- [x] <command or check that passed>
- [ ] <manual check still needed, if any>

## Risk / Rollback
- Risk: <main regression or operational risk, or "Low" with reason>
- Rollback: <revert commit, disable feature, or restore previous behavior>

## RPIV Task
- Task: `<source>:<id>`
- Slice: <slice name>
- Branch: `<branch>`

## Human Review Checklist
- [ ] Review changed files for repo conventions.
- [ ] Confirm verification evidence is sufficient.
- [ ] Confirm no secrets, local-only paths, or scratch artifacts are included.
```

### PR/MR body rules
- Keep the body concise and reviewer-focused.
- Prefer bullets over paragraphs.
- Include verification commands exactly as run.
- Include failed or skipped verification as explicit unchecked items with reasons.
- Include known risks instead of saying “none” unless risk is genuinely low and explained.
- Include the RPIV task id and slice name so review can trace back to `WORK.md`.
- Do not include private notes, secrets, environment variable values, or local scratch paths.

### GitHub example
```bash
body_file=$(mktemp)
cat > "$body_file" <<'EOF'
## Summary
- ...

## Scope
- ...

## Verification
- [x] ...

## Risk / Rollback
- Risk: ...
- Rollback: ...

## RPIV Task
- Task: `local:setup-v2`
- Slice: Slice 1 — Idempotent `/triage` helper
- Branch: `feat/setup-v2`

## Human Review Checklist
- [ ] Review changed files for repo conventions.
- [ ] Confirm verification evidence is sufficient.
- [ ] Confirm no secrets, local-only paths, or scratch artifacts are included.
EOF

gh pr create --draft --title "<title>" --body-file "$body_file"
```

### GitLab example
```bash
body_file=$(mktemp)
cat > "$body_file" <<'EOF'
## Summary
- ...
EOF

glab mr create --draft --title "<title>" --description "$(cat "$body_file")"
```

Prefer true body-file flags when available. If the CLI only supports a string description, write the body to a temp file first and read it from there to avoid inline shell quoting mistakes.

## Output contract
End with:
- **Slice implemented**
- **Verification run**
- **Commit**
- **Draft PR/MR**
- **Human review required**
