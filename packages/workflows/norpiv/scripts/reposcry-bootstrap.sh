#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

ensure_reposcry_gitignore() {
  local gitignore=".gitignore"
  touch "$gitignore"

  if ! grep -qxF ".reposcry/" "$gitignore"; then
    {
      printf '\n# RepoScry local cache\n'
      printf '.reposcry/\n'
    } >> "$gitignore"
    echo "Added .reposcry/ to .gitignore"
  fi
}

refuse_tracked_reposcry_cache() {
  local tracked staged
  tracked=$(git ls-files .reposcry 2>/dev/null || true)
  staged=$(git diff --cached --name-only -- .reposcry 2>/dev/null || true)

  if [[ -n "$tracked" || -n "$staged" ]]; then
    echo "ERROR: .reposcry/ cache is tracked or staged. It is generated local state and must not be committed." >&2
    if [[ -n "$tracked" ]]; then
      echo "Tracked files:" >&2
      printf '%s\n' "$tracked" >&2
    fi
    if [[ -n "$staged" ]]; then
      echo "Staged files:" >&2
      printf '%s\n' "$staged" >&2
    fi
    echo "Fix: git rm --cached -r .reposcry && keep .reposcry/ in .gitignore" >&2
    exit 1
  fi
}

reposcry_indexed_files() {
  reposcry stats 2>/dev/null | awk '/Files indexed:/ {print $3; exit}'
}

# Quick health check for Pulse info
check_pulse() {
  if ! command -v reposcry >/dev/null 2>&1; then
    echo "PULSE: Missing (Not installed)"
    return
  fi
  if [[ ! -d .reposcry ]]; then
    echo "PULSE: Cold (No cache)"
    return
  fi
  local files
  files=$(reposcry_indexed_files || echo "0")
  if [[ "$files" == "0" ]]; then
    echo "PULSE: Cold (Zero files)"
  else
    echo "PULSE: Warm ($files files)"
  fi
}

if [[ "${1:-}" == "--pulse" ]]; then
  check_pulse
  exit 0
fi

ensure_reposcry_gitignore
refuse_tracked_reposcry_cache

if ! command -v reposcry >/dev/null 2>&1; then
  echo "RepoScry not installed; skipping bootstrap."
  exit 0
fi

HAD_REPOSCRYIGNORE=0
[[ -f .reposcryignore ]] && HAD_REPOSCRYIGNORE=1

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

INDEXED_FILES=$(reposcry_indexed_files || true)
INDEXED_FILES=${INDEXED_FILES:-0}

if [[ $FORCE_REINDEX -eq 1 || "$INDEXED_FILES" == "0" ]]; then
  echo "Indexing repository with RepoScry (--no-semantic)..."
  reposcry index --no-semantic || {
    echo "RepoScry index failed; continuing without RepoScry." >&2
    exit 0
  }
else
  echo "RepoScry index already present ($INDEXED_FILES files indexed)."
fi

if [[ $HAD_REPOSCRYIGNORE -eq 0 && -f .reposcryignore ]]; then
  echo "RepoScry created .reposcryignore. Review and commit it if you want stable RepoScry indexing rules."
fi
