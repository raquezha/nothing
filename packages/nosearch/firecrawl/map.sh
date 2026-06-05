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
Usage: ./map.sh <url> [--search <query>] [--limit <n>] [--include-subdomains] [--ignore-query-parameters] [--sitemap <include|skip|only>] [--json]
EOF
}

firecrawl_map_main() {
  firecrawl_require_tools

  URL=""
  SEARCH_QUERY=""
  LIMIT=""
  INCLUDE_SUBDOMAINS=false
  IGNORE_QUERY_PARAMETERS=false
  SITEMAP_MODE=""
  JSON=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --search)
        [[ $# -ge 2 ]] || firecrawl_error "--search requires a value."
        SEARCH_QUERY="$2"
        shift
        ;;
      --limit)
        [[ $# -ge 2 ]] || firecrawl_error "--limit requires a value."
        LIMIT="$2"
        shift
        ;;
      --include-subdomains)
        INCLUDE_SUBDOMAINS=true
        ;;
      --ignore-query-parameters)
        IGNORE_QUERY_PARAMETERS=true
        ;;
      --sitemap)
        [[ $# -ge 2 ]] || firecrawl_error "--sitemap requires a value."
        SITEMAP_MODE="$2"
        shift
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

  if [[ -n "$LIMIT" && ! "$LIMIT" =~ ^[0-9]+$ ]]; then
    firecrawl_error "--limit expects a non-negative integer."
  fi
  if [[ -n "$SITEMAP_MODE" && ! "$SITEMAP_MODE" =~ ^(include|skip|only)$ ]]; then
    firecrawl_error "--sitemap expects include, skip, or only."
  fi

  PAYLOAD="$(jq -n \
    --arg url "$URL" \
    --arg search "$SEARCH_QUERY" \
    --arg limit "$LIMIT" \
    --argjson includeSubdomains "$INCLUDE_SUBDOMAINS" \
    --argjson ignoreQueryParameters "$IGNORE_QUERY_PARAMETERS" \
    --arg sitemap "$SITEMAP_MODE" \
    '{
      url: $url,
      includeSubdomains: $includeSubdomains,
      ignoreQueryParameters: $ignoreQueryParameters
    }
    + (if $search == "" then {} else {search: $search} end)
    + (if $limit == "" then {} else {limit: ($limit | tonumber)} end)
    + (if $sitemap == "" then {} else {sitemap: $sitemap} end)')"

  RESPONSE="$(firecrawl_request "/v1/map" "$PAYLOAD")"

  if [[ "$JSON" == true ]]; then
    jq . <<<"$RESPONSE"
    exit 0
  fi

  LINKS="$(jq -r '
    if (.links? | type) == "array" then
      .links[]
    elif ((.data? // {}) | (.links? | type == "array")) then
      .data.links[]
    else
      empty
    end
  ' <<<"$RESPONSE")"

  if [[ -n "$LINKS" ]]; then
    printf '%s\n' "$LINKS"
  else
    jq . <<<"$RESPONSE"
  fi
}

if [[ "${1:-}" == "--worker-entry" ]]; then
  shift
  firecrawl_map_main "$@"
  exit $?
fi

search_worker_run "$0" "$@"
