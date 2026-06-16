#!/usr/bin/env bash

# enforce-branch.sh
# Verifies the active branch before implementation.
# Prevents working on main/master and ensures alignment with task metadata.

set -euo pipefail

json_read() {
    local file="$1"
    local expr="$2"
    python3 - "$file" "$expr" <<'PY'
import json
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
expr = sys.argv[2]
try:
    data = json.loads(path.read_text())
except Exception:
    print("")
    raise SystemExit

for part in [p.strip() for p in expr.split("//")]:
    if part == "empty":
        continue
    match = re.fullmatch(r"\.([A-Za-z_][A-Za-z0-9_]*)", part)
    if not match or not isinstance(data, dict):
        continue
    value = data.get(match.group(1))
    if value not in (None, ""):
        print(value)
        raise SystemExit
print("")
PY
}

json_pretty() {
    local file="$1"
    python3 -m json.tool "$file"
}

# Find repo root to ensure paths are absolute and reliable
REPO_ROOT=$(git rev-parse --show-toplevel)
ACTIVE_TASK_FILE="$REPO_ROOT/.workflow/active_task.json"

if [[ ! -f "$ACTIVE_TASK_FILE" ]]; then
    echo "ERROR: No active task found at $ACTIVE_TASK_FILE."
    echo "Please run /triage [source]:[id] first."
    exit 1
fi

# Read canonical active task fields
TASK_SOURCE=$(json_read "$ACTIVE_TASK_FILE" '.source // empty')
TASK_ID=$(json_read "$ACTIVE_TASK_FILE" '.sourceId // .id // empty')
TASK_PATH=$(json_read "$ACTIVE_TASK_FILE" '.taskPath // .path // empty')

# Prefer explicit taskPath when available (most reliable)
if [[ -n "$TASK_PATH" ]]; then
    echo "INFO: Using taskPath from active_task.json: $TASK_PATH"
    if [[ "$TASK_PATH" = /* ]]; then
        WORK_MD="$TASK_PATH/WORK.md"
    else
        WORK_MD="$REPO_ROOT/$TASK_PATH/WORK.md"
    fi

# If no taskPath, but we have a source+id, construct the folder name as '<source>-<id>'
elif [[ -n "$TASK_ID" ]]; then
    echo "INFO: taskPath missing; deriving task folder from source+id"
    if [[ -n "$TASK_SOURCE" ]]; then
        TASK_FOLDER="${TASK_SOURCE}-${TASK_ID}"
    else
        TASK_FOLDER="$TASK_ID"
    fi
    WORK_MD="$REPO_ROOT/.workflow/tasks/$TASK_FOLDER/WORK.md"

else
    echo "ERROR: No 'sourceId' or 'taskPath' found in $ACTIVE_TASK_FILE."
    echo "Please run /triage [source]:[id] to initialize a task. Here are the file contents for debugging:" 
    json_pretty "$ACTIVE_TASK_FILE" || true
    exit 1
fi

# Diagnostic output for easier debugging when things go wrong
echo "DEBUG: Computed WORK.md path: $WORK_MD"

if [[ ! -f "$WORK_MD" ]]; then
    echo "ERROR: WORK.md not found at $WORK_MD."
    echo "Checked active_task.json values:" 
    json_pretty "$ACTIVE_TASK_FILE" || true
    echo "Please ensure the task was initialized with /triage and that WORK.md exists." 
    exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# Check if we are on a protected branch
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
    echo "WARNING: Currently on protected branch '$CURRENT_BRANCH'."
    
    # Generate a safe task branch name
    # Prefer using the active_task folder name if available, else sanitize TASK_ID
    if [[ -n "${TASK_FOLDER:-}" ]]; then
        CLEAN_ID=$(echo "$TASK_FOLDER" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-//;s/-$//')
    else
        CLEAN_ID=$(echo "$TASK_ID" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-//;s/-$//')
    fi
    NEW_BRANCH="feat/${CLEAN_ID}"
    
    echo "ACTION: Creating and switching to task branch: $NEW_BRANCH"
    git checkout -b "$NEW_BRANCH"
    echo "SUCCESS: Branch switched to $NEW_BRANCH."
    echo "AGENT_INSTRUCTION: Update [META] in WORK.md to record 'Branch: $NEW_BRANCH'."
    exit 0
fi

echo "Branch is not protected. Safe to proceed."
echo "AGENT_INSTRUCTION: Ensure $CURRENT_BRANCH is recorded in [META] of WORK.md."
exit 0
