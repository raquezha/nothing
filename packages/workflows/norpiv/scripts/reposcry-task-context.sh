#!/usr/bin/env bash

set -euo pipefail

TASK_TEXT=${*:-}
if [[ -z "$TASK_TEXT" ]]; then
  echo "Usage: $0 <task summary>"
  exit 1
fi

if ! command -v reposcry >/dev/null 2>&1; then
  echo "RepoScry not installed; skipping task context generation."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

"$SCRIPT_DIR/reposcry-bootstrap.sh" || true

mkdir -p .reposcry

# Detect low-token modes (Caveman, etc.)
DEFAULT_BUDGET=20000
if [[ "${CAVEMAN_MODE:-off}" != "off" ]] || [[ "${LOW_TOKEN_MODE:-0}" == "1" ]]; then
  DEFAULT_BUDGET=5000
  echo "Low-token mode detected: reducing context budget to $DEFAULT_BUDGET"
fi

BUDGET=${REPOSCRY_CONTEXT_BUDGET:-$DEFAULT_BUDGET}
OUTPUT_PATH=".reposcry/AI_CONTEXT.md"

echo "Generating RepoScry task context at $OUTPUT_PATH..."
if reposcry context "$TASK_TEXT" --strict --budget "$BUDGET" --format markdown > "$OUTPUT_PATH"; then
  echo "Wrote $OUTPUT_PATH"
else
  echo "RepoScry context generation failed; leaving RPIV flow unchanged." >&2
  rm -f "$OUTPUT_PATH"
fi
