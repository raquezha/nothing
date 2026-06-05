#!/usr/bin/env bash
set -euo pipefail

# Triage Helper: Manages namespaced task workspaces
# Usage: triage_helper.sh [source] [id]

SOURCE="${1:-}"
ID="${2:-}"
BASE_DIR=".workflow/tasks"

if [[ -z "$SOURCE" || -z "$ID" ]]; then
  echo "Usage: triage_helper.sh [github|gitlab|jira|local] [id]" >&2
  exit 1
fi

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "ERROR: triage_helper.sh must be run inside a git repository." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
mkdir -p "$BASE_DIR"

BRANCH_NAME="$(git rev-parse --abbrev-ref HEAD)"
ID_LOWER="$(printf '%s' "$ID" | tr '[:upper:]' '[:lower:]')"
if [[ "$SOURCE" == "local" && "$ID_LOWER" =~ ^(problem|task|issue|work|todo)$ ]]; then
  ID="$(printf '%s' "$BRANCH_NAME" | sed 's/[^a-zA-Z0-9]/-/g')"
  echo "Generic local ID detected. Falling back to branch-derived name '$ID'..."
fi

TASK_FOLDER="$SOURCE-$ID"
TASK_DIR="$BASE_DIR/$TASK_FOLDER"
mkdir -p "$TASK_DIR"

echo "Initializing workspace in $TASK_DIR..."

case "$SOURCE" in
  github)
    command -v gh >/dev/null 2>&1 || { echo "ERROR: gh CLI is required for github tasks." >&2; exit 1; }
    echo "Fetching GitHub Issue #$ID..."
    gh issue view "$ID" --json title,body,author,labels,comments > "$TASK_DIR/metadata.json"
    echo "# WORK: GitHub #$ID" > "$TASK_DIR/WORK.md"
    gh issue view "$ID" >> "$TASK_DIR/WORK.md"
    ;;
  gitlab)
    command -v glab >/dev/null 2>&1 || { echo "ERROR: glab CLI is required for gitlab tasks." >&2; exit 1; }
    echo "Fetching GitLab Issue #$ID..."
    glab issue view "$ID" > "$TASK_DIR/WORK.md"
    printf '{"id":"%s","source":"gitlab"}\n' "$ID" > "$TASK_DIR/metadata.json"
    ;;
  jira)
    if command -v jira >/dev/null 2>&1; then
      echo "Fetching Jira Ticket $ID with jira CLI..."
      jira issue view "$ID" > "$TASK_DIR/WORK.md"
      jira issue view "$ID" --raw > "$TASK_DIR/metadata.json"
    elif command -v acli >/dev/null 2>&1; then
      echo "Fetching Jira Ticket $ID with acli..."
      acli jira workitem view "$ID" > "$TASK_DIR/WORK.md"
      printf '{"id":"%s","source":"jira"}\n' "$ID" > "$TASK_DIR/metadata.json"
    else
      echo "ERROR: jira or acli CLI is required for jira tasks." >&2
      exit 1
    fi
    ;;
  local)
    echo "Initializing local task workspace: $ID..."
    echo "# WORK: Local Task $ID" > "$TASK_DIR/WORK.md"
    printf '{"id":"%s","source":"local"}\n' "$ID" > "$TASK_DIR/metadata.json"
    ;;
  *)
    echo "Unknown source: $SOURCE" >&2
    exit 1
    ;;
esac

if command -v jq >/dev/null 2>&1; then
  jq --arg branch "$BRANCH_NAME" --arg tf "$TASK_FOLDER" '. + {branch: $branch, taskFolder: $tf}' "$TASK_DIR/metadata.json" > "$TASK_DIR/metadata.json.tmp"
  mv "$TASK_DIR/metadata.json.tmp" "$TASK_DIR/metadata.json"
else
  python3 - "$TASK_DIR/metadata.json" "$BRANCH_NAME" "$TASK_FOLDER" <<'PY'
import json, sys
path, branch, task_folder = sys.argv[1:4]
with open(path) as f:
    data = json.load(f)
data["branch"] = branch
data["taskFolder"] = task_folder
with open(path, "w") as f:
    json.dump(data, f)
PY
fi

cat >> "$TASK_DIR/WORK.md" <<EOF

## [BRIEF]
- 

## [PLAN]
- [ ] 

## [LOG]
- $(date +"%Y-%m-%d %I:%M %p"): Task initialized via /triage
EOF

if ! grep -q "\[META\]" "$TASK_DIR/WORK.md"; then
  cat >> "$TASK_DIR/WORK.md" <<EOF

[META]
Branch: $BRANCH_NAME
EOF
fi

cat > ".workflow/active_task.json" <<JSON
{"active_task":"$TASK_FOLDER","source":"$SOURCE","id":"$ID","sourceId":"$ID","taskPath":"$TASK_DIR","path":"$TASK_DIR","branch":"$BRANCH_NAME"}
JSON

echo "Triage complete. Single-file WORK.md ready at $TASK_DIR."
