#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/../_worker.sh"

usage() {
  cat <<'EOF'
Usage: ./read.sh <url>
EOF
}

brave_read_main() {
  URL="${1:-}"
  if [[ -z "$URL" ]]; then
    usage
    exit 1
  fi

  curl -s "https://r.jina.ai/$URL"
}

if [[ "${1:-}" == "--worker-entry" ]]; then
  shift
  brave_read_main "$@"
  exit $?
fi

search_worker_run "$0" "$@"
