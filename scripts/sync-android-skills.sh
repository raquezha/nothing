#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${ANDROID_SKILLS_REPO:-https://github.com/android/skills.git}"
REF="${ANDROID_SKILLS_REF:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST="$ROOT_DIR/vendor/android-skills"
TMP="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP"
}
trap cleanup EXIT

printf '▸ Syncing Android skills from %s (%s)\n' "$REPO_URL" "$REF"
git clone --depth 1 --branch "$REF" "$REPO_URL" "$TMP/android-skills" >/dev/null
rm -rf "$TMP/android-skills/.git"
rm -rf "$DEST"
mkdir -p "$(dirname "$DEST")"
cp -R "$TMP/android-skills" "$DEST"

count="$(find "$DEST" -name SKILL.md | wc -l | tr -d ' ')"
printf '✅ Synced %s Android skills into %s\n' "$count" "$DEST"
