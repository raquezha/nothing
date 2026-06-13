#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/headroom/compose.yml"
DATA_DIR="${HEADROOM_DATA_DIR:-$HOME/.local/share/headroom}"
URL="${HEADROOM_URL:-http://127.0.0.1:8788}"

mkdir -p "$DATA_DIR"

docker compose -f "$COMPOSE_FILE" up -d

for _ in {1..45}; do
  if curl -fsS "$URL/health" >/dev/null 2>&1; then
    HEADROOM_HEALTH_SUMMARY="${HEADROOM_HEALTH_SUMMARY:-0}" bash "$ROOT/scripts/headroom-health.sh"
    exit 0
  fi
  sleep 1
done

echo "Headroom failed to become healthy after 45 seconds" >&2
exit 1
