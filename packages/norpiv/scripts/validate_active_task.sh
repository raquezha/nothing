#!/usr/bin/env bash

# validate_active_task.sh
# Lightweight, print-only validation of .workflow/active_task.json and related files.
# This script never mutates task state; it only reports inconsistencies and suggested fixes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRIAGE_HELPER="$SCRIPT_DIR/triage_helper.sh"
REPO_ROOT=$(git rev-parse --show-toplevel)
ATF="$REPO_ROOT/.workflow/active_task.json"
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || true)
WORK_MD=""
TASK_DIR=""
META=""
WARNINGS=0
ERRORS=0

warn() {
  WARNINGS=$((WARNINGS + 1))
  echo "WARN: $*"
}

error() {
  ERRORS=$((ERRORS + 1))
  echo "ERROR: $*"
}

ok() {
  echo "OK: $*"
}

json_read() {
  local file="$1"
  local expr="$2"
  if [[ ! -f "$file" ]]; then
    echo ""
    return
  fi
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

# Supports the tiny subset used by this validator:
# .field and .field // .fallback // empty
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

count_section() {
  local section="$1"
  local file="$2"
  grep -Ec "^(## )?\[$section\][[:space:]]*$" "$file" 2>/dev/null || true
}

section_body_nonempty() {
  local section="$1"
  local file="$2"
  python3 - "$file" "$section" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
section = sys.argv[2]
text = path.read_text() if path.exists() else ""
lines = text.splitlines()
header = re.compile(rf"^(## )?\[{re.escape(section)}\]\s*$")
any_header = re.compile(r"^(## )?\[[A-Z0-9_-]+\]\s*$")
start = next((i for i, line in enumerate(lines) if header.match(line)), None)
if start is None:
    print("no")
    raise SystemExit
end = len(lines)
for i in range(start + 1, len(lines)):
    if any_header.match(lines[i]):
        end = i
        break
body = "\n".join(lines[start + 1:end]).strip()
meaningful = [line.strip() for line in body.splitlines() if line.strip() and line.strip() not in {"-", "- [ ]"}]
print("yes" if meaningful else "no")
PY
}

has_plan_checkbox() {
  local file="$1"
  python3 - "$file" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text() if path.exists() else ""
lines = text.splitlines()
header = re.compile(r"^(## )?\[PLAN\]\s*$")
any_header = re.compile(r"^(## )?\[[A-Z0-9_-]+\]\s*$")
start = next((i for i, line in enumerate(lines) if header.match(line)), None)
if start is None:
    print("no")
    raise SystemExit
end = len(lines)
for i in range(start + 1, len(lines)):
    if any_header.match(lines[i]):
        end = i
        break
body = "\n".join(lines[start + 1:end])
print("yes" if re.search(r"- \[[ xX]\]", body) else "no")
PY
}

print_json_field_report() {
  local label="$1"
  local file="$2"
  shift 2

  echo
  echo "$label field check:"
  for field in "$@"; do
    local value
    value=$(json_read "$file" ".$field")
    if [[ -n "$value" ]]; then
      ok "$field=$value"
    else
      warn "$label missing .$field"
    fi
  done
}

if [[ ! -f "$ATF" ]]; then
  error "No active_task.json found at $ATF"
  echo "Suggested fixes (dry):"
  echo "  - Run: $TRIAGE_HELPER <source> <id>"
  exit 1
fi

if ! python3 -m json.tool "$ATF" >/dev/null 2>&1; then
  error "active_task.json is not valid JSON: $ATF"
  exit 1
fi

echo "Active task file: $ATF"
json_pretty "$ATF" || true

TASK_PATH=$(json_read "$ATF" '.taskPath // .path')
TASK_SOURCE=$(json_read "$ATF" '.source')
TASK_ID=$(json_read "$ATF" '.sourceId // .id')
ACTIVE_TASK=$(json_read "$ATF" '.active_task')
POINTER_BRANCH=$(json_read "$ATF" '.branch')

print_json_field_report "active_task.json" "$ATF" active_task source id sourceId taskPath path branch

echo
if [[ -n "$TASK_PATH" ]]; then
  if [[ "$TASK_PATH" = /* ]]; then
    WORK_MD="$TASK_PATH/WORK.md"
  else
    WORK_MD="$REPO_ROOT/$TASK_PATH/WORK.md"
  fi
  echo "Using taskPath -> checking: $WORK_MD"
elif [[ -n "$TASK_ID" ]]; then
  echo "No taskPath in active_task.json; attempting to derive from source+id"
  if [[ -n "$TASK_SOURCE" ]]; then
    TASK_FOLDER="$TASK_SOURCE-$TASK_ID"
  else
    TASK_FOLDER="$TASK_ID"
  fi
  WORK_MD="$REPO_ROOT/.workflow/tasks/$TASK_FOLDER/WORK.md"
  echo "Derived path: $WORK_MD"
else
  error "Neither taskPath/path nor sourceId/id present in active_task.json"
fi

if [[ -n "$WORK_MD" && -f "$WORK_MD" ]]; then
  ok "WORK.md exists at $WORK_MD"
  TASK_DIR=$(dirname "$WORK_MD")
  META="$TASK_DIR/metadata.json"
else
  error "WORK.md not found at ${WORK_MD:-<unknown>}"
fi

if [[ -n "$ACTIVE_TASK" && -n "$TASK_DIR" ]]; then
  ACTUAL_TASK_FOLDER=$(basename "$TASK_DIR")
  if [[ "$ACTIVE_TASK" == "$ACTUAL_TASK_FOLDER" ]]; then
    ok "active_task matches task folder ($ACTIVE_TASK)"
  else
    warn "active_task ($ACTIVE_TASK) differs from task folder ($ACTUAL_TASK_FOLDER)"
  fi
fi

if [[ -n "$CURRENT_BRANCH" && -n "$POINTER_BRANCH" ]]; then
  if [[ "$CURRENT_BRANCH" == "$POINTER_BRANCH" ]]; then
    ok "current branch matches active pointer ($CURRENT_BRANCH)"
  else
    warn "current branch ($CURRENT_BRANCH) differs from active pointer branch ($POINTER_BRANCH)"
  fi
fi

META_ID=""
META_SOURCE=""
META_TASK_FOLDER=""
META_STATUS=""
META_PHASE=""
META_BRANCH=""

if [[ -n "$META" ]]; then
  if [[ -f "$META" ]]; then
    if python3 -m json.tool "$META" >/dev/null 2>&1; then
      echo
      echo "Metadata file: $META"
      json_pretty "$META" || true
      print_json_field_report "metadata.json" "$META" id source taskFolder status phase branch createdAt updatedAt

      META_ID=$(json_read "$META" '.id')
      META_SOURCE=$(json_read "$META" '.source')
      META_TASK_FOLDER=$(json_read "$META" '.taskFolder')
      META_STATUS=$(json_read "$META" '.status')
      META_PHASE=$(json_read "$META" '.phase')
      META_BRANCH=$(json_read "$META" '.branch')

      if [[ -n "$META_ID" && -n "$TASK_ID" && "$META_ID" != "$TASK_ID" ]]; then
        warn "metadata.id ($META_ID) differs from active_task id/sourceId ($TASK_ID)"
      fi
      if [[ -n "$META_SOURCE" && -n "$TASK_SOURCE" && "$META_SOURCE" != "$TASK_SOURCE" ]]; then
        warn "metadata.source ($META_SOURCE) differs from active_task.source ($TASK_SOURCE)"
      fi
      if [[ -n "$META_TASK_FOLDER" && -n "$TASK_DIR" && "$META_TASK_FOLDER" != "$(basename "$TASK_DIR")" ]]; then
        warn "metadata.taskFolder ($META_TASK_FOLDER) differs from task folder ($(basename "$TASK_DIR"))"
      fi
      if [[ -n "$CURRENT_BRANCH" && -n "$META_BRANCH" && "$CURRENT_BRANCH" != "$META_BRANCH" ]]; then
        warn "current branch ($CURRENT_BRANCH) differs from metadata.branch ($META_BRANCH)"
      fi
    else
      error "metadata.json is not valid JSON: $META"
    fi
  else
    warn "metadata.json not found at $META"
  fi
fi

if [[ -n "$WORK_MD" && -f "$WORK_MD" ]]; then
  echo
  echo "WORK.md section health:"
  for section in BRIEF GRILL PLAN LOG META; do
    count=$(count_section "$section" "$WORK_MD")
    case "$count" in
      0) warn "missing [$section] section" ;;
      1) ok "[$section] section present once" ;;
      *) warn "duplicate [$section] sections found ($count)" ;;
    esac
  done

  if [[ "$META_PHASE" =~ ^(planned|implementing|verifying|synced|closed)$ ]]; then
    if [[ "$(has_plan_checkbox "$WORK_MD")" == "yes" ]]; then
      ok "[PLAN] contains checkboxes for phase=$META_PHASE"
    else
      warn "phase=$META_PHASE but [PLAN] has no checkboxes"
    fi
  fi

  if [[ "$META_PHASE" == "triaged" && "$(section_body_nonempty "BRIEF" "$WORK_MD")" == "yes" ]]; then
    warn "phase=triaged but [BRIEF] appears populated; consider updating phase metadata"
  fi
fi

if [[ "$META_STATUS" =~ ^(done|archived)$ ]]; then
  warn "active pointer references a task with status=$META_STATUS; consider post-merge-prune, archive handling, or reopening intentionally"
fi

echo
echo "Suggested fixes (dry):"
if [[ -n "$WORK_MD" && ! -f "$WORK_MD" ]]; then
  echo "  - Re-run triage: $TRIAGE_HELPER <source> <id>"
  echo "  - Or update .workflow/active_task.json to include a correct taskPath or source+id"
fi
if [[ -n "$META" && ! -f "$META" ]]; then
  echo "  - Resume/backfill metadata: $TRIAGE_HELPER ${TASK_SOURCE:-local} ${TASK_ID:-task} resume"
elif [[ -n "$META" && -f "$META" ]]; then
  if [[ -z "$META_STATUS" || -z "$META_PHASE" || -z "$(json_read "$META" '.createdAt')" || -z "$(json_read "$META" '.updatedAt')" ]]; then
    echo "  - Backfill missing metadata fields: $TRIAGE_HELPER ${TASK_SOURCE:-local} ${TASK_ID:-task} resume"
  fi
fi
if [[ -n "$WORK_MD" && -f "$WORK_MD" ]]; then
  for section in BRIEF GRILL PLAN LOG META; do
    count=$(count_section "$section" "$WORK_MD")
    if [[ "$count" -gt 1 ]]; then
      echo "  - Manually merge duplicate [$section] sections in $WORK_MD"
    fi
  done
fi
if [[ -n "$META_STATUS" && "$META_STATUS" =~ ^(done|archived)$ ]]; then
  echo "  - Choose intentionally: $TRIAGE_HELPER ${TASK_SOURCE:-local} ${TASK_ID:-task} reopen"
  echo "  - Or leave closed and run post-merge-prune when appropriate."
fi
if [[ "$WARNINGS" -eq 0 && "$ERRORS" -eq 0 ]]; then
  echo "  - No fixes suggested."
fi

echo
echo "Validation complete (print-only). warnings=$WARNINGS errors=$ERRORS"
if [[ "$ERRORS" -gt 0 ]]; then
  exit 1
fi
