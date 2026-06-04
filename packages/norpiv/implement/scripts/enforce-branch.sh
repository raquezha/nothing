#!/usr/bin/env bash

# enforce-branch.sh
# Verifies the active branch before implementation.
# Prevents working on main/master and ensures alignment with task metadata.

set -euo pipefail

# Find repo root to ensure paths are absolute and reliable
REPO_ROOT=$(git rev-parse --show-toplevel)
ACTIVE_TASK_FILE="$REPO_ROOT/.workflow/active_task.json"

if [[ ! -f "$ACTIVE_TASK_FILE" ]]; then
    echo "ERROR: No active task found at $ACTIVE_TASK_FILE."
    echo "Please run /triage [source]:[id] first."
    exit 1
fi

# Read canonical active task fields
TASK_SOURCE=$(jq -r '.source // empty' "$ACTIVE_TASK_FILE")
TASK_ID=$(jq -r '.sourceId // .id // empty' "$ACTIVE_TASK_FILE")
TASK_PATH=$(jq -r '.taskPath // .path // empty' "$ACTIVE_TASK_FILE")

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
    jq '.' "$ACTIVE_TASK_FILE" || true
    exit 1
fi

# Diagnostic output for easier debugging when things go wrong
echo "DEBUG: Computed WORK.md path: $WORK_MD"

if [[ ! -f "$WORK_MD" ]]; then
    echo "ERROR: WORK.md not found at $WORK_MD."
    echo "Checked active_task.json values:" 
    jq -r '.active_task, .source, .id, .sourceId, .taskPath, .path, .branch' "$ACTIVE_TASK_FILE" || true
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
