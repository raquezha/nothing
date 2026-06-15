# AGENTS.md

## Tool invocation hygiene

- Prefer single-line ASCII-only bash.
- Avoid heredocs, smart quotes, non-breaking spaces, and control chars in tool input.
- Avoid multiline strings in python -c (use semicolons or a temp script).
- Prefer python -c or a temp script file for structured logic.
- Use simple probes first: curl, grep, head, awk, jq.

Safe templates:

```bash
curl -fsS http://127.0.0.1:19998/api/v1/info | head -c 500
curl -fsS 'http://127.0.0.1:19998/api/v1/data?chart=NAME&after=-3d&before=0&format=json' | head -c 800
grep -n -i 'temp\|thermal\|temperature' file | head -n 50
python -c "import json; print(json.load(open('file.json'))['key'])"
```

## Environment setup

If `pi` is missing or outdated, reload the shell integration:
`source ~/RQZ/personal/nothing/dotfiles/shell_integration.sh`
