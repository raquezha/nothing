---
name: implement
workflow: rpiv
workflowPhase: implement
description: Implement the next approved vertical slice from the active WORK.md and prepare a Draft PR/MR. Use when the plan is approved and the user explicitly asks to implement.
---

# Skill: implement

Execute one functional vertical slice and hand it to the human for review.

## Guardrails
- READ: `.workflow/active.json` first, then compatibility `.workflow/active_task.json` only if needed, then active `WORK.md` `[PLAN]`, `[BRIEF]`, and relevant `[LOG]` evidence.
- WRITE: code changes and `WORK.md` -> append to `[LOG]` only.
- NEVER: edit `[BRIEF]` or `[GRILL]`.
- NEVER: implement without explicit user instruction.
- EVIDENCE REJECTION GATE: Before modifying code, `/implement` MUST verify that the target slice is not flagged `[BLOCKED: missing UI/formula evidence]` and evidence status is not `missing`. If blocked, STOP immediately, refuse code changes, surface what evidence is missing (direct Zeplin screen link `https://zpl.io/<id>`, direct Figma frame URL, or formula spec), and ask the human for explicit clarification or override. Never guess product UI or formula truth around a blocked state.
- NEVER: add `Signed-off-by`; only the human can certify DCO.
- NEVER: freestyle PR/MR descriptions; use the Draft PR/MR body contract below.

## Workflow
1. Identify the first approved unchecked slice in `[PLAN]`. Verify the slice is not marked `[BLOCKED: missing UI/formula evidence]`. If blocked, STOP and ask the human for missing direct evidence or explicit override.
2. **Mandatory Branch Check**: You MUST run the branch enforcement script before modifying any code.
   - Use the absolute path if possible: `<skill_location>/scripts/enforce-branch.sh`.
   - This script prevents accidental implementation on `main`/`master`.
   - If the script switches branches, you must update the `[META]` section of `WORK.md` to reflect the new branch name.
   - If the script fails, STOP and ask the human for help. Do not proceed with code changes.
3. Select the executable child item, not an umbrella parent; if it is unclear, STOP and ask.
4. Move that remote item to **In Progress** immediately before code changes.
   - Jira: transition only when an `In Progress`-style state exists.
   - GitHub / GitLab: use an existing repository-specific status mapping only; do not invent a label, comment, or MR change. If none exists, leave the item unchanged and record why in `[LOG]`.
   - If a configured transition fails, STOP and ask the human; do not begin code changes.
   - Do not mark work in progress during `/refine`, `/triage`, `/frame`, or `/plan`.
5. Implement test-first where practical; otherwise document why not in `[LOG]`.
6. Run the slice verification command and available quality gates.
7. Commit using the repository's normal conventions and hooks/CI rules.
   - If the repo or tracker expects a Jira key, preserve it where that repository normally requires it.
   - If AI attribution trailers are required, obtain them from the repository's documented policy rather than hard-coding RPIV-specific formatting.
8. Push and open a Draft PR/MR with `gh` or `glab` when a remote exists.
9. Use a temporary body file (`--body-file` or API equivalent) for PR/MR descriptions to avoid shell quoting and markdown escaping bugs.
10. Append summary, commit hash, and PR/MR link to `[LOG]` (Format: `YYYY-MM-DD hh:mm AM/PM`).

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
