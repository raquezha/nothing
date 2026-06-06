#!/usr/bin/env bash

set -euo pipefail

if ! command -v reposcry >/dev/null 2>&1; then
  echo "RepoScry not installed; skipping bootstrap."
  exit 0
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

FORCE_REINDEX=0
if [[ "${1:-}" == "--force" || "${1:-}" == "--reindex" ]]; then
  FORCE_REINDEX=1
fi

if [[ ! -d .reposcry ]]; then
  echo "Initializing RepoScry..."
  reposcry init >/dev/null 2>&1 || reposcry init || {
    echo "RepoScry init failed; continuing without RepoScry." >&2
    exit 0
  }
fi

if [[ $FORCE_REINDEX -eq 1 || ! -f .reposcry/reposcry.db ]]; then
  echo "Indexing repository with RepoScry (--no-semantic)..."
  reposcry index --no-semantic || {
    echo "RepoScry index failed; continuing without RepoScry." >&2
    exit 0
  }
else
  echo "RepoScry cache already present at .reposcry/reposcry.db"
fi
