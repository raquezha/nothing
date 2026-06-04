#!/usr/bin/env bash
set -euo pipefail

firecrawl_error() {
  echo "Error: $*" >&2
  exit 1
}

firecrawl_require_tools() {
  command -v curl >/dev/null 2>&1 || firecrawl_error "curl is required."
  command -v jq >/dev/null 2>&1 || firecrawl_error "jq is required."
}

firecrawl_require_token() {
  if [[ -z "${FIRECRAWL_API_TOKEN:-}" ]]; then
    firecrawl_error "FIRECRAWL_API_TOKEN is not set."
  fi
  printf '%s' "$FIRECRAWL_API_TOKEN"
}

firecrawl_base_url() {
  local base="${FIRECRAWL_BASE_URL:-https://api.firecrawl.dev}"
  printf '%s' "${base%/}"
}

firecrawl_request() {
  local path="$1"
  local payload="$2"
  local base token response_file http_code curl_status=0

  base="$(firecrawl_base_url)"
  token="$(firecrawl_require_token)" || return 1
  response_file="$(mktemp "${TMPDIR:-/tmp}/firecrawl.XXXXXX")"

  http_code="$(curl -sS -o "$response_file" -w '%{http_code}' \
    -X POST "${base}${path}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "Authorization: Bearer ${token}" \
    --data "$payload")" || curl_status=$?

  if [[ "$curl_status" -ne 0 ]]; then
    rm -f "$response_file"
    firecrawl_error "Firecrawl request failed (curl exit ${curl_status})."
  fi

  if [[ ! "$http_code" =~ ^2 ]]; then
    echo "Firecrawl API HTTP ${http_code}:" >&2
    cat "$response_file" >&2
    rm -f "$response_file"
    exit 1
  fi

  cat "$response_file"
  rm -f "$response_file"
}
