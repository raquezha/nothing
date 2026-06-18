# AGENTS.md (MANDATORY PROTOCOL)

## Tool invocation hygiene (CRITICAL)

The environment has aggressive security guardrails. To avoid being **BLOCKED**:

- **BASH**:
  - **NO** context flags in grep (`-A`, `-B`, `-C`). Use `read` with `limit` and `offset` instead.
  - **NO** complex pipes (`a | b | c | d`). Keep it to `cmd | head` or `cmd | jq`.
  - **NO** heredocs (`<<EOF`). Use `write` or temporary files.
  - **NO** non-ASCII characters or control characters in strings.
  - **PREFER**: `read` tool for examining files. It is faster and safer.
- **PYTHON/NODE**: Use these for any logic, parsing, or data transformation. Use `python -c "..."` for simple one-liners or write a script for complex tasks.
- **JQ**: Use `jq` for ALL JSON parsing. Do not try to `grep` JSON.

## TOKENMAXXING
- **BATCH**: Use one `edit` call for multiple changes in a file.
- **SCOPE**: Never `ls -R` `node_modules`. Use `find . -maxdepth 2`.
- **PRECISE**: Use `read` with `limit` and `offset` to probe large files.

## Monitoring (Netdata)

{{NETDATA_INSTRUCTIONS}}

## Standard Repository Patterns

### AGENTS.md Management
- **Source of Truth**: `config/AGENTS.md` (symlinked as `./AGENTS.md` in repo root).
- **Deployment**: `~/AGENTS.md` is auto-generated and overwritten by `bootstrap.sh`.
- **Edit Rule**: Always edit the version in the repository. Direct edits to `~/AGENTS.md` will be lost on bootstrap.

### Extension & Skill Structure (Pi)
Always use the nested directory pattern to ensure correct discovery and naming:
- **Extensions Source**: `packages/<name>/extensions/<name>/index.ts`
- **Extensions Build**: `packages/<name>/dist/<name>/index.js`
- **Skills**: Use `packages/<name>/SKILL.md` (or `packages/<name>/<sub-skill>/SKILL.md` for multi-skill packages).
- **package.json**: Set `"pi": { "extensions": ["extensions"] }` and `"main": "dist/<name>/index.js"`.
- This avoids extensions appearing with `.ts` suffixes or generic "extensions" names.

### Adding Hats & Modifiers
When adding a new Pi "hat" or modifier:
1. **Logic**: Add flag parsing and extension/skill loading to `dotfiles/shell_integration.sh`.
2. **Help**: Update the `printf` tables in `bootstrap.sh` to include the new flag in the `hats`, `modifiers`, or `combo` sections.
3. **Mindsets**: If it's a base hat, add its default skills/extensions to `config/mindsets.json`.

### Package Issue Closure Rule
- For npm package behavior fixes under `packages/*`, PR bodies must use `Refs #ISSUE`, not `Closes/Fixes/Resolves #ISSUE`, because merge does not deliver the fix to npm users. Close the issue only after the package version is published.
- Add a changeset for package changes unless intentionally unreleased and documented.
- If a package PR references an issue, include the same `Refs #ISSUE` in the changeset body so the generated changelog can drive post-publish issue closure.

### AI Commit Attribution
- **Deterministic Identity**: Never guess or hallucinate the active model when writing `Assisted-by` trailers in git commits.
- **Enforcement**: Run `packages/norpiv/scripts/get-pi-model.sh` to deterministically extract the true active model from the harness logs and inject its exact output.

### Retrospective & Workflow
- **.notrace/**: Owns all retrospective artifacts (`notrace.json`, `notrace.html`, `notrace.review.json`).
- **.workflow/**: Owns active task state and RPIV context.
- **WORK.md**: Should only *reference* notrace artifacts via relative links, never own them.
- **notrace Ownership**: Treat `notrace` as the durable retrospective layer, not the live Pi footer or resume UX.
- **Telemetry Rule**: Keep consumed session usage metrics separate from optimization metrics such as Headroom tokens saved; do not merge them into one ambiguous total.

## Docker Recovery (Linux)
If homelab services are down or laptop recently restarted:
```bash
find ~/homelab -name "docker-compose.yml" -exec docker compose -f {} up -d \;
```

## Environment setup

If `pi` is missing or outdated, reload the shell integration:
`source ~/RQZ/personal/nothing/dotfiles/shell_integration.sh`
