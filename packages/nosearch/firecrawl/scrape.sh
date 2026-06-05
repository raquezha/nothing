#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/common.sh"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/../_worker.sh"

# Used by ../_worker.sh via dynamic environment lookup.
# shellcheck disable=SC2034
SEARCH_WORKER_REQUIRED_ENV="FIRECRAWL_API_TOKEN"

usage() {
  cat <<'EOF'
Usage: ./scrape.sh <url> [--full] [--wait <ms>] [--timeout <ms>] [--mobile] [--json]

Defaults to main-content markdown.
EOF
}

firecrawl_scrape_main() {
  firecrawl_require_tools

  URL=""
  ONLY_MAIN_CONTENT=true
  WAIT_FOR=""
  TIMEOUT_MS=""
  MOBILE=false
  JSON=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --full)
        ONLY_MAIN_CONTENT=false
        ;;
      --main)
        ONLY_MAIN_CONTENT=true
        ;;
      --wait)
        [[ $# -ge 2 ]] || firecrawl_error "--wait requires a value."
        WAIT_FOR="$2"
        shift
        ;;
      --timeout)
        [[ $# -ge 2 ]] || firecrawl_error "--timeout requires a value."
        TIMEOUT_MS="$2"
        shift
        ;;
      --mobile)
        MOBILE=true
        ;;
      --json)
        JSON=true
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      --*)
        firecrawl_error "Unknown flag: $1"
        ;;
      *)
        if [[ -z "$URL" ]]; then
          URL="$1"
        else
          firecrawl_error "Unexpected extra argument: $1"
        fi
        ;;
    esac
    shift
  done

  if [[ -z "$URL" ]]; then
    usage
    exit 1
  fi

  if [[ -n "$WAIT_FOR" && ! "$WAIT_FOR" =~ ^[0-9]+$ ]]; then
    firecrawl_error "--wait expects a non-negative integer."
  fi
  if [[ -n "$TIMEOUT_MS" && ! "$TIMEOUT_MS" =~ ^[0-9]+$ ]]; then
    firecrawl_error "--timeout expects a non-negative integer."
  fi

  PAYLOAD="$(jq -n \
    --arg url "$URL" \
    --argjson onlyMainContent "$ONLY_MAIN_CONTENT" \
    --argjson mobile "$MOBILE" \
    --arg waitFor "$WAIT_FOR" \
    --arg timeout "$TIMEOUT_MS" \
    '{
      url: $url,
      formats: ["markdown"],
      onlyMainContent: $onlyMainContent,
      mobile: $mobile
    }
    + (if $waitFor == "" then {} else {waitFor: ($waitFor | tonumber)} end)
    + (if $timeout == "" then {} else {timeout: ($timeout | tonumber)} end)')"

  RESPONSE="$(firecrawl_request "/v1/scrape" "$PAYLOAD")"

  if [[ "$JSON" == true ]]; then
    jq . <<<"$RESPONSE"
    exit 0
  fi

  MARKDOWN="$(jq -r '.data.markdown // empty' <<<"$RESPONSE")"
  if [[ -n "$MARKDOWN" ]]; then
    printf '%s\n' "$MARKDOWN"
    metadata="$(jq -r '
      .data.metadata // empty
      | if type == "object" then
          [
            (if .title? then "Title: \(.title)" else empty end),
            (if .description? then "Description: \(.description)" else empty end),
            (if .url? then "URL: \(.url)" else empty end),
            (if .statusCode? then "Status: \(.statusCode)" else empty end)
          ]
          | join("\n")
        else empty end
    ' <<<"$RESPONSE")"
    if [[ -n "$metadata" ]]; then
      echo
      echo "---"
      echo "Metadata:"
      echo "$metadata"
    fi
  else
    jq . <<<"$RESPONSE"
  fi
}

if [[ "${1:-}" == "--worker-entry" ]]; then
  shift
  firecrawl_scrape_main "$@"
  exit $?
fi

search_worker_run "$0" "$@"
