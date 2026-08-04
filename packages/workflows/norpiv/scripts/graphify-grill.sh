#!/usr/bin/env bash
# Optional structural Graphify pass over committed HEAD only.
set -u

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "WARN: Graphify skipped: not a git repository." >&2; exit 0; }
python=${GRAPHIFY_PYTHON:-"$repo_root/.graphify/venv/bin/python"}
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
temp=$(mktemp -d "${TMPDIR:-/tmp}/norpiv-graphify.XXXXXX") || { echo "WARN: Graphify skipped: cannot create temporary directory." >&2; exit 0; }
trap 'rm -rf "$temp"' EXIT

if [[ ! -x "$python" ]]; then
  echo "WARN: Graphify skipped: project-local Python is unavailable." >&2
  exit 0
fi
if ! git -C "$repo_root" archive HEAD | tar -x -C "$temp"; then
  echo "WARN: Graphify skipped: cannot archive HEAD." >&2
  exit 0
fi
if ! "$python" "$script_dir/graphify-grill.py" "$temp"; then
  echo "WARN: Graphify failed; continue with normal source reading." >&2
fi
