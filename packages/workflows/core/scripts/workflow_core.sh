#!/usr/bin/env bash
# Shared workflow helper for nothing
# Handles only active pointer, section append, metadata update.

WORKFLOW_DIR=".workflow"
ACTIVE_PTR="$WORKFLOW_DIR/active.json"

function workflow_set_active() {
  local workflow_type="$1"
  local workflow_id="$2"
  local state_file="$3"
  
  mkdir -p "$WORKFLOW_DIR"
  
  cat > "$ACTIVE_PTR" <<EOF
{
  "workflow": "$workflow_type",
  "id": "$workflow_id",
  "stateFile": "$state_file",
  "startedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
}

function workflow_get_active() {
  if [[ -f "$ACTIVE_PTR" ]]; then
    cat "$ACTIVE_PTR"
  else
    echo "{}"
  fi
}

function workflow_append_section() {
  local state_file="$1"
  local section_header="$2"
  local content="$3"
  
  if [[ ! -f "$state_file" ]]; then
    mkdir -p "$(dirname "$state_file")"
    touch "$state_file"
  fi
  
  echo -e "\n## $section_header\n" >> "$state_file"
  echo -e "$content\n" >> "$state_file"
}

function workflow_update_metadata() {
  local meta_file="$1"
  local key="$2"
  local value="$3"
  
  if [[ ! -f "$meta_file" ]]; then
    mkdir -p "$(dirname "$meta_file")"
    echo "{}" > "$meta_file"
  fi
  
  # A very simple update using jq
  local tmp
  tmp=$(mktemp)
  jq --arg k "$key" --arg v "$value" '.[$k] = $v' "$meta_file" > "$tmp" && mv "$tmp" "$meta_file"
}

"$@"
