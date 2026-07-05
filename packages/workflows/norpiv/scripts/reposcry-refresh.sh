#!/usr/bin/env bash

set -euo pipefail

BASE_REF=${1:-${REPOSCRY_BASE_REF:-main}}

if ! command -v reposcry-update >/dev/null 2>&1; then
  echo "reposcry-update not installed; skipping refresh."
  exit 0
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

echo "Refreshing RepoScry for changed files against base '$BASE_REF'..."
if ! reposcry-update --changed --base "$BASE_REF"; then
  echo "RepoScry refresh failed; continuing without refreshed graph state." >&2
  exit 0
fi
