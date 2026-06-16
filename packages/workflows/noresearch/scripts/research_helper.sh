#!/usr/bin/env bash

# Research Helper: Manages research workflow state.
# Usage:
#   research_helper.sh start <topic> [id]
#   research_helper.sh log <message>
#   research_helper.sh close [artifact-path]

set -euo pipefail

MODE=${1:-}
ARG=${2:-}
OPTIONAL=${3:-}
BASE_DIR=".workflow/research"
ACTIVE_WORKFLOW=".workflow/active_workflow.json"

if [[ -z "$MODE" ]]; then
  echo "Usage: $0 start <topic> [id] | log <message> | close [artifact-path]"
  exit 1
fi

case "$MODE" in
  start|log|close) ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Usage: $0 start <topic> [id] | log <message> | close [artifact-path]"
    exit 1
    ;;
esac

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "ERROR: research_helper.sh must be run inside a git repository."
  exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
NOW=$(LC_TIME=C date +"%Y-%m-%d %I:%M %p")
ISO_NOW=$(LC_TIME=C date -u +"%Y-%m-%dT%H:%M:%SZ")

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\{2,\}/-/g; s/^-//; s/-$//'
}

json_get() {
  local file="$1"
  local key="$2"
  python3 - "$file" "$key" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
key = sys.argv[2]
try:
    data = json.loads(path.read_text())
    if isinstance(data, dict):
        value = data.get(key, "")
        print("" if value is None else value)
except Exception:
    print("")
PY
}

write_json() {
  local file="$1"
  shift
  python3 - "$file" "$@" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
data = {}
for item in sys.argv[2:]:
    key, value = item.split("=", 1)
    data[key] = value
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(data, indent=2, sort_keys=False) + "\n")
PY
}

json_upsert() {
  local file="$1"
  shift
  python3 - "$file" "$@" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
updates = {}
for item in sys.argv[2:]:
    key, value = item.split("=", 1)
    updates[key] = value

if path.exists() and path.read_text().strip():
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError:
        data = {}
else:
    data = {}

if not isinstance(data, dict):
    data = {}

data.update(updates)
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(data, indent=2, sort_keys=False) + "\n")
PY
}

ensure_section() {
  local file="$1"
  local section="$2"
  local body="$3"
  if [[ ! -f "$file" ]]; then
    return
  fi
  if ! grep -Eq "^(## )?\[$section\][[:space:]]*$" "$file"; then
    printf '\n## [%s]\n%s\n' "$section" "$body" >> "$file"
  fi
}

append_section_entry() {
  local file="$1"
  local section="$2"
  local entry="$3"
  ensure_section "$file" "$section" ""
  python3 - "$file" "$section" "$entry" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
section = sys.argv[2]
entry = sys.argv[3]
text = path.read_text() if path.exists() else ""
lines = text.splitlines()
section_re = re.compile(rf"^(## )?\[{re.escape(section)}\]\s*$")
header_re = re.compile(r"^(## )?\[[A-Z0-9_-]+\]\s*$")
start = next((i for i, line in enumerate(lines) if section_re.match(line)), None)
if start is None:
    if text and not text.endswith("\n"):
        text += "\n"
    text += f"\n## [{section}]\n{entry}\n"
    path.write_text(text)
    raise SystemExit
end = len(lines)
for i in range(start + 1, len(lines)):
    if header_re.match(lines[i]):
        end = i
        break
while end > start + 1 and lines[end - 1].strip() == "":
    end -= 1
updated = lines[:end] + [entry] + lines[end:]
path.write_text("\n".join(updated).rstrip() + "\n")
PY
}

active_workflow_id() {
  [[ -f "$ACTIVE_WORKFLOW" ]] && json_get "$ACTIVE_WORKFLOW" id || true
}

active_workflow_name() {
  [[ -f "$ACTIVE_WORKFLOW" ]] && json_get "$ACTIVE_WORKFLOW" workflow || true
}

start_research() {
  local topic="$ARG"
  local requested_id="$OPTIONAL"
  if [[ -z "$topic" ]]; then
    echo "ERROR: research start requires a topic."
    exit 1
  fi

  local research_id
  research_id="${requested_id:-$(slugify "$topic")}" 
  if [[ -z "$research_id" ]]; then
    echo "ERROR: Could not derive research id from topic."
    exit 1
  fi

  local existing_workflow existing_id
  existing_workflow=$(active_workflow_name)
  existing_id=$(active_workflow_id)
  if [[ -n "$existing_workflow" && ( "$existing_workflow" != "research" || "$existing_id" != "$research_id" ) ]]; then
    echo "ERROR: This branch/worktree already has active workflow '$existing_workflow/$existing_id'."
    echo "Use a separate worktree/branch or close the active workflow first."
    exit 2
  fi

  local research_dir="$BASE_DIR/$research_id"
  local research_md="$research_dir/RESEARCH.md"
  local metadata_json="$research_dir/metadata.json"
  mkdir -p "$research_dir"

  if [[ ! -f "$research_md" ]]; then
    cat > "$research_md" <<EOF
# RESEARCH: $topic

## [QUESTION]
- $topic

## [SCOPE]
- Goal:
- Non-goals:

## [FINDINGS]
- 

## [TRACE]
- 

## [LOG]
- $NOW: Research initialized via /research.start

## [META]
- Branch: \`$BRANCH_NAME\`
- Status: \`active\`
- Phase: \`started\`
- Research ID: \`$research_id\`
EOF
  else
    append_section_entry "$research_md" "LOG" "- $NOW: Research resumed via /research.start"
  fi

  json_upsert "$metadata_json" \
    "id=$research_id" \
    "topic=$topic" \
    "branch=$BRANCH_NAME" \
    "status=active" \
    "phase=started" \
    "stateFile=$research_md" \
    "createdAt=$ISO_NOW" \
    "updatedAt=$ISO_NOW"

  write_json "$ACTIVE_WORKFLOW" \
    "workflow=research" \
    "id=$research_id" \
    "researchId=$research_id" \
    "stateFile=$research_md" \
    "researchPath=$research_dir" \
    "path=$research_dir" \
    "branch=$BRANCH_NAME" \
    "startedAt=$ISO_NOW" \
    "updatedAt=$ISO_NOW"

  echo "Research workflow active: $research_id"
  echo "State file: $research_md"
}

log_research() {
  local message="$ARG"
  if [[ -z "$message" ]]; then
    echo "ERROR: research log requires a message."
    exit 1
  fi
  local workflow id state_file
  workflow=$(active_workflow_name)
  id=$(active_workflow_id)
  state_file=$([[ -f "$ACTIVE_WORKFLOW" ]] && json_get "$ACTIVE_WORKFLOW" stateFile || true)
  if [[ "$workflow" != "research" || -z "$id" || -z "$state_file" ]]; then
    echo "ERROR: No active research workflow in this branch/worktree."
    exit 1
  fi
  append_section_entry "$state_file" "LOG" "- $NOW: $message"
  json_upsert "$BASE_DIR/$id/metadata.json" "phase=exploring" "updatedAt=$ISO_NOW"
  json_upsert "$ACTIVE_WORKFLOW" "updatedAt=$ISO_NOW"
  echo "Logged research update to $state_file"
}

close_research() {
  local artifact="$ARG"
  local workflow id state_file research_dir
  workflow=$(active_workflow_name)
  id=$(active_workflow_id)
  state_file=$([[ -f "$ACTIVE_WORKFLOW" ]] && json_get "$ACTIVE_WORKFLOW" stateFile || true)
  research_dir=$([[ -f "$ACTIVE_WORKFLOW" ]] && json_get "$ACTIVE_WORKFLOW" researchPath || true)
  if [[ "$workflow" != "research" || -z "$id" || -z "$state_file" ]]; then
    echo "ERROR: No active research workflow in this branch/worktree."
    exit 1
  fi
  if [[ -n "$artifact" ]]; then
    append_section_entry "$state_file" "TRACE" "- Artifact: $artifact"
  fi
  append_section_entry "$state_file" "LOG" "- $NOW: Research closed via /research.close"
  json_upsert "$research_dir/metadata.json" "status=closed" "phase=closed" "closedAt=$ISO_NOW" "updatedAt=$ISO_NOW"
  rm -f "$ACTIVE_WORKFLOW"
  echo "Research workflow closed: $id"
  echo "State file retained: $state_file"
}

case "$MODE" in
  start) start_research ;;
  log) log_research ;;
  close) close_research ;;
esac
