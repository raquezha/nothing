#!/usr/bin/env bash

# Triage Helper: Manages namespaced task workspaces.
# Usage: ./triage_helper.sh [github|gitlab|jira|local] [id] [auto|resume|reopen|fresh|reset]
#
# Default mode is auto:
# - create missing tasks
# - resume existing active/blocked tasks
# - refuse done/archived tasks unless explicitly reopened/reset

set -euo pipefail

SOURCE=${1:-}
ID=${2:-}
MODE=${3:-auto}
BASE_DIR=".workflow/tasks"

if [[ -z "$SOURCE" || -z "$ID" ]]; then
    echo "Usage: $0 [github|gitlab|jira|local] [id] [auto|resume|reopen|fresh|reset]"
    exit 1
fi

case "$MODE" in
    auto|resume|reopen|fresh|reset) ;;
    *)
        echo "Unknown mode: $MODE"
        echo "Valid modes: auto, resume, reopen, fresh, reset"
        exit 1
        ;;
esac

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
    echo "ERROR: triage_helper.sh must be run inside a git repository."
    exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
NOW=$(LC_TIME=C date +"%Y-%m-%d %I:%M %p")
ISO_NOW=$(LC_TIME=C date -u +"%Y-%m-%dT%H:%M:%SZ")

# Sanitize local ID if generic (case-insensitive check)
ID_LOWER=$(echo "$ID" | tr '[:upper:]' '[:lower:]')
if [[ "$SOURCE" == "local" && "$ID_LOWER" =~ ^(problem|task|issue|work|todo)$ ]]; then
    ID=$(echo "$BRANCH_NAME" | sed 's/[^a-zA-Z0-9]/-/g')
    echo "Generic local ID detected. Falling back to branch-derived name '$ID'..."
fi

TASK_FOLDER="$SOURCE-$ID"
TASK_DIR="$BASE_DIR/$TASK_FOLDER"
WORK_MD="$TASK_DIR/WORK.md"
METADATA_JSON="$TASK_DIR/metadata.json"

json_upsert() {
    local file="$1"
    shift
    python3 - "$file" "$@" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
updates = {}
preserve_existing = set()
for item in sys.argv[2:]:
    key, value = item.split("=", 1)
    if key.startswith("?"):
        key = key[1:]
        preserve_existing.add(key)
    updates[key] = value

if path.exists():
    raw = path.read_text().strip()
    if raw:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {"raw": raw}
    else:
        data = {}
else:
    data = {}

if not isinstance(data, dict):
    data = {"raw": data}

for key, value in updates.items():
    if key == "createdAt" and data.get("createdAt"):
        continue
    if key in preserve_existing and data.get(key):
        continue
    data[key] = value

path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(data, indent=2, sort_keys=False) + "\n")
PY
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

write_active_pointer() {
    mkdir -p ".workflow"
    python3 - ".workflow/active_task.json" "$TASK_FOLDER" "$SOURCE" "$ID" "$TASK_DIR" "$BRANCH_NAME" <<'PY'
import json
import sys
from pathlib import Path

path, active_task, source, raw_id, task_path, branch = sys.argv[1:]
data = {
    "active_task": active_task,
    "source": source,
    "id": raw_id,
    "sourceId": raw_id,
    "taskPath": task_path,
    "path": task_path,
    "branch": branch,
}
Path(path).write_text(json.dumps(data, indent=2) + "\n")
PY
}

ensure_section() {
    local section="$1"
    local body="$2"

    if [[ ! -f "$WORK_MD" ]]; then
        return
    fi

    if ! grep -Eq "^(## )?\[$section\][[:space:]]*$" "$WORK_MD"; then
        printf '\n## [%s]\n%s\n' "$section" "$body" >> "$WORK_MD"
    fi
}

append_log() {
    local message="$1"
    local entry="- $NOW: $message"
    ensure_section "LOG" ""
    python3 - "$WORK_MD" "$entry" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
entry = sys.argv[2]
text = path.read_text() if path.exists() else ""
lines = text.splitlines()
log_re = re.compile(r"^(## )?\[LOG\]\s*$")
header_re = re.compile(r"^(## )?\[[A-Z0-9_-]+\]\s*$")
start = next((i for i, line in enumerate(lines) if log_re.match(line)), None)
if start is None:
    if text and not text.endswith("\n"):
        text += "\n"
    text += "\n## [LOG]\n" + entry + "\n"
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

update_work_meta() {
    local status phase
    status=$(json_get "$METADATA_JSON" status)
    phase=$(json_get "$METADATA_JSON" phase)
    status=${status:-active}
    phase=${phase:-triaged}

    python3 - "$WORK_MD" "$BRANCH_NAME" "$status" "$phase" "$SOURCE" "$ID" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
branch, status, phase, source, raw_id = sys.argv[2:]
text = path.read_text() if path.exists() else ""
lines = text.splitlines()
header_re = re.compile(r"^(## )?\[[A-Z0-9_-]+\]\s*$")
meta_re = re.compile(r"^(## )?\[META\]\s*$")

new_block = [
    "## [META]",
    f"- Branch: `{branch}`",
    f"- Status: `{status}`",
    f"- Phase: `{phase}`",
    f"- Source: `{source}:{raw_id}`",
]

start = next((i for i, line in enumerate(lines) if meta_re.match(line)), None)
if start is None:
    if text and not text.endswith("\n"):
        text += "\n"
    text += "\n" + "\n".join(new_block) + "\n"
    path.write_text(text)
    sys.exit(0)

end = len(lines)
for i in range(start + 1, len(lines)):
    if header_re.match(lines[i]):
        end = i
        break

updated = lines[:start] + new_block + lines[end:]
path.write_text("\n".join(updated).rstrip() + "\n")
PY
}

backfill_metadata() {
    json_upsert "$METADATA_JSON" \
        "id=$ID" \
        "source=$SOURCE" \
        "branch=$BRANCH_NAME" \
        "taskFolder=$TASK_FOLDER" \
        "?status=active" \
        "?phase=triaged" \
        "createdAt=$ISO_NOW" \
        "updatedAt=$ISO_NOW"
}

set_metadata_status_phase() {
    local status="$1"
    local phase="$2"
    json_upsert "$METADATA_JSON" \
        "id=$ID" \
        "source=$SOURCE" \
        "branch=$BRANCH_NAME" \
        "taskFolder=$TASK_FOLDER" \
        "status=$status" \
        "phase=$phase" \
        "createdAt=$ISO_NOW" \
        "updatedAt=$ISO_NOW"
}

create_task() {
    mkdir -p "$TASK_DIR"
    echo "Creating task workspace in $TASK_DIR..."

    case "$SOURCE" in
        github)
            command -v gh >/dev/null 2>&1 || { echo "ERROR: gh CLI is required for github tasks."; exit 1; }
            echo "Fetching GitHub Issue #$ID..."
            gh issue view "$ID" --json title,body,author,labels,comments > "$METADATA_JSON"
            echo "# WORK: GitHub #$ID" > "$WORK_MD"
            gh issue view "$ID" >> "$WORK_MD"
            ;;
        gitlab)
            command -v glab >/dev/null 2>&1 || { echo "ERROR: glab CLI is required for gitlab tasks."; exit 1; }
            echo "Fetching GitLab Issue #$ID..."
            glab issue view "$ID" > "$WORK_MD"
            echo '{}' > "$METADATA_JSON"
            ;;
        jira)
            echo "Fetching Jira Ticket $ID..."
            if command -v jira >/dev/null 2>&1; then
                jira issue view "$ID" > "$WORK_MD"
                jira issue view "$ID" --raw > "$METADATA_JSON"
            elif command -v acli >/dev/null 2>&1; then
                acli jira workitem view "$ID" > "$WORK_MD"
                echo '{}' > "$METADATA_JSON"
            else
                echo "ERROR: jira or acli CLI is required for jira tasks."
                exit 1
            fi
            ;;
        local)
            echo "Initializing local task workspace: $ID..."
            echo "# WORK: Local Task $ID" > "$WORK_MD"
            echo '{}' > "$METADATA_JSON"
            ;;
        *)
            echo "Unknown source: $SOURCE"
            exit 1
            ;;
    esac

    set_metadata_status_phase "active" "triaged"
    ensure_section "BRIEF" "- "
    ensure_section "GRILL" "- "
    ensure_section "PLAN" "- [ ] "
    ensure_section "LOG" ""
    update_work_meta
    append_log "Task initialized via /triage"
    write_active_pointer
    echo "Triage complete. Created WORK.md at $WORK_MD."
}

resume_task() {
    if [[ ! -f "$WORK_MD" ]]; then
        echo "ERROR: Cannot resume; WORK.md not found at $WORK_MD"
        exit 1
    fi

    [[ -f "$METADATA_JSON" ]] || echo '{}' > "$METADATA_JSON"
    backfill_metadata
    ensure_section "BRIEF" "- "
    ensure_section "GRILL" "- "
    ensure_section "PLAN" "- [ ] "
    ensure_section "LOG" ""
    update_work_meta
    append_log "Task resumed via /triage"
    write_active_pointer
    echo "Triage complete. Resumed existing task at $TASK_DIR."
}

reopen_task() {
    if [[ ! -f "$WORK_MD" ]]; then
        echo "ERROR: Cannot reopen; WORK.md not found at $WORK_MD"
        exit 1
    fi

    set_metadata_status_phase "active" "triaged"
    ensure_section "BRIEF" "- "
    ensure_section "GRILL" "- "
    ensure_section "PLAN" "- [ ] "
    ensure_section "LOG" ""
    update_work_meta
    append_log "Task reopened via /triage"
    write_active_pointer
    echo "Triage complete. Reopened task at $TASK_DIR."
}

fresh_task() {
    if [[ -e "$TASK_DIR" ]]; then
        local backup_dir="$TASK_DIR.archive.$(LC_TIME=C date -u +"%Y%m%dT%H%M%SZ")"
        mv "$TASK_DIR" "$backup_dir"
        echo "Archived existing task workspace to $backup_dir"
    fi
    create_task
}

if [[ -f "$WORK_MD" ]]; then
    [[ -f "$METADATA_JSON" ]] || echo '{}' > "$METADATA_JSON"
    STATUS=$(json_get "$METADATA_JSON" status)
    STATUS=${STATUS:-active}

    case "$MODE" in
        auto|resume)
            case "$STATUS" in
                active|blocked|"")
                    resume_task
                    ;;
                done)
                    echo "Task $TASK_FOLDER is marked done. Use mode 'reopen' to resume it or 'fresh' to start over."
                    exit 2
                    ;;
                archived)
                    echo "Task $TASK_FOLDER is archived. Use mode 'reopen' or 'fresh' explicitly."
                    exit 2
                    ;;
                *)
                    echo "Task $TASK_FOLDER has unknown status '$STATUS'; resuming conservatively."
                    resume_task
                    ;;
            esac
            ;;
        reopen)
            reopen_task
            ;;
        fresh|reset)
            fresh_task
            ;;
    esac
else
    case "$MODE" in
        auto|fresh|reset)
            create_task
            ;;
        resume|reopen)
            echo "Task $TASK_FOLDER does not exist; creating it instead."
            create_task
            ;;
    esac
fi
