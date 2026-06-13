#!/usr/bin/env bash
set -euo pipefail

URL="${HEADROOM_URL:-http://127.0.0.1:8788}"

echo "Headroom health: $URL/health"
if command -v curl >/dev/null 2>&1; then
  health_json="$(curl -fsS "$URL/health")"
  if [[ "${HEADROOM_HEALTH_SUMMARY:-0}" == "1" ]] && command -v jq >/dev/null 2>&1; then
    jq -r '"status=" + .status + " ready=" + (.ready|tostring) + " version=" + .version' <<< "$health_json"
  else
    printf '%s\n' "$health_json"
  fi
else
  python - "$URL/health" <<'PY'
import sys, urllib.request
print(urllib.request.urlopen(sys.argv[1], timeout=10).read().decode())
PY
fi

if [[ "${HEADROOM_HEALTH_SUMMARY:-0}" == "1" ]]; then
  exit 0
fi

echo "Headroom stats: $URL/stats"
if command -v curl >/dev/null 2>&1; then
  curl -fsS "$URL/stats" || true
  echo
fi
