#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

printf 'scripts/sync-android-skills.sh is deprecated. Use scripts/android-skills-refresh.sh.\n' >&2
exec "$SCRIPT_DIR/android-skills-refresh.sh" "$@"
