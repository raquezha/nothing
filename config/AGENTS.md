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
