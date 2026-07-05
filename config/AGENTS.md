# AGENTS.md (UNIVERSAL BASELINE)

## Tool invocation hygiene (CRITICAL)

The environment has aggressive security guardrails. To avoid being **BLOCKED**:

- **BASH**:
  - **NO** context flags in grep (`-A`, `-B`, `-C`). Use `read` with `limit` and `offset` instead.
  - **NO** complex pipes (`a | b | c | d`). Keep it to `cmd | head` or `cmd | jq`.
  - **NO** heredocs (`<<EOF`). Use `write` or temporary files.
  - **NO** non-ASCII characters or control characters in strings.
  - **PREFER**: `read` tool for examining files. It is faster and safer.
- **PYTHON/NODE**: Use these for any logic, parsing, or data transformation.
- **JQ**: Use `jq` for ALL JSON parsing. Do not try to `grep` JSON.

## TOKENMAXXING
- **BATCH**: Use one `edit` call for multiple changes in a file.
- **SCOPE**: Never `ls -R` `node_modules`. Use `find . -maxdepth 2`.
- **PRECISE**: Use `read` with `limit` and `offset` to probe large files.

## Workflow & State
- **3 Real Modes**: Chat (ephemeral/no state), Research (think+write, `.workflow/research/`), and RPIV (execution, `.workflow/tasks/`).
- **Pointer**: Always respect `.workflow/active.json`. If it exists, you are in that workflow.
- **Domains**: CLI hats (`pi --research`, `pi --rpiv`) determine your loaded context. Do not try to auto-route or infer directories; trust the boundaries.
