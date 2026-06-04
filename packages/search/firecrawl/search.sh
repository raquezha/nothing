#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/common.sh"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/../_worker.sh"

usage() {
  cat <<'EOF'
Usage: ./search.sh <query> [--limit <n>] [--lang <code>] [--country <code>] [--scrape] [--json]
EOF
}

firecrawl_search_main() {
  firecrawl_require_tools

  QUERY=""
  LIMIT=""
  LANGUAGE=""
  COUNTRY=""
  SCRAPE=false
  JSON=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --limit)
        [[ $# -ge 2 ]] || firecrawl_error "--limit requires a value."
        LIMIT="$2"
        shift
        ;;
      --lang)
        [[ $# -ge 2 ]] || firecrawl_error "--lang requires a value."
        LANGUAGE="$2"
        shift
        ;;
      --country)
        [[ $# -ge 2 ]] || firecrawl_error "--country requires a value."
        COUNTRY="$2"
        shift
        ;;
      --scrape)
        SCRAPE=true
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
        if [[ -z "$QUERY" ]]; then
          QUERY="$1"
        else
          QUERY+=" $1"
        fi
        ;;
    esac
    shift
  done

  if [[ -z "$QUERY" ]]; then
    usage
    exit 1
  fi

  if [[ -n "$LIMIT" && ! "$LIMIT" =~ ^[0-9]+$ ]]; then
    firecrawl_error "--limit expects a non-negative integer."
  fi

  PAYLOAD="$(jq -n \
    --arg query "$QUERY" \
    --arg limit "$LIMIT" \
    --arg lang "$LANGUAGE" \
    --arg country "$COUNTRY" \
    --argjson scrape "$SCRAPE" \
    '{
      query: $query
    }
    + (if $limit == "" then {} else {limit: ($limit | tonumber)} end)
    + (if $lang == "" then {} else {lang: $lang} end)
    + (if $country == "" then {} else {country: $country} end)
    + (if $scrape then {scrapeOptions: {formats: ["markdown"], onlyMainContent: true}} else {} end)')"

  RESPONSE="$(firecrawl_request "/v1/search" "$PAYLOAD")"

  if [[ "$JSON" == true ]]; then
    jq . <<<"$RESPONSE"
    exit 0
  fi

  MARKDOWN="$(jq -r '
    if (.data? | type) == "object" and (.data.markdown? | type) == "string" then .data.markdown
    elif (.markdown? | type) == "string" then .markdown
    else empty end
  ' <<<"$RESPONSE")"
  if [[ -n "$MARKDOWN" ]]; then
    printf '%s\n' "$MARKDOWN"
    exit 0
  fi

  RESULTS="$(jq -r '
    def items:
      if (.data? | type) == "array" then .data
      elif ((.data? // {}) | (.results? | type == "array")) then .data.results
      elif (.results? | type) == "array" then .results
      else [] end;

    items[] |
      "Title: \(.title // .name // "Untitled")\nURL: \(.url // "")\nDescription: \(.description // .snippet // .content // "")\n---"
  ' <<<"$RESPONSE")"

  if [[ -n "$RESULTS" ]]; then
    printf '%s\n' "$RESULTS"
  else
    jq . <<<"$RESPONSE"
  fi
}

if [[ "${1:-}" == "--worker-entry" ]]; then
  shift
  firecrawl_search_main "$@"
  exit $?
fi

search_worker_run "$0" "$@"
