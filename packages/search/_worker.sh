#!/usr/bin/env bash
set -euo pipefail

search_worker_has_tmux() {
  command -v tmux >/dev/null 2>&1
}

search_worker_mode() {
  printf '%s' "${SEARCH_WORKER_MODE:-auto}"
}

search_worker_env_file() {
  printf '%s' "${SEARCH_WORKER_ENV_FILE:-$HOME/.pi-secrets/.env}"
}

search_worker_warn() {
  printf 'Warning: %s\n' "$*" >&2
}

search_worker_error() {
  printf 'Error: %s\n' "$*" >&2
  return 1
}

search_worker_load_env_file() {
  local env_file status=0
  env_file="$(search_worker_env_file)"
  [[ -f "$env_file" ]] || return 0

  set +e
  set -a
  # shellcheck disable=SC1090
  source "$env_file" || status=$?
  set +a
  set -e
  return "$status"
}

search_worker_require_envs() {
  local required="${SEARCH_WORKER_REQUIRED_ENV:-}"
  local missing=() var

  [[ -n "$required" ]] || return 0

  for var in $required; do
    [[ -n "${!var:-}" ]] || missing+=("$var")
  done

  if (( ${#missing[@]} > 0 )); then
    search_worker_load_env_file || return 1
  fi

  missing=()
  for var in $required; do
    [[ -n "${!var:-}" ]] || missing+=("$var")
  done

  if (( ${#missing[@]} > 0 )); then
    search_worker_error "${missing[*]} is not set."
    return 1
  fi
}

search_worker_should_require_envs() {
  [[ $# -gt 0 ]] || return 1

  for arg in "$@"; do
    case "$arg" in
      -h|--help)
        return 1
        ;;
    esac
  done

  return 0
}

search_worker_run() {
  local entrypoint="$1"
  shift || true

  local mode timeout session_prefix workdir temp_dir stdout_file stderr_file code_file session inner_cmd status deadline
  mode="$(search_worker_mode)"
  timeout="${SEARCH_WORKER_TIMEOUT_SECONDS:-300}"
  session_prefix="${SEARCH_WORKER_SESSION_PREFIX:-pi-search}"
  workdir="$PWD"

  if search_worker_should_require_envs "$@"; then
    search_worker_require_envs || return $?
  fi

  temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/pi-search-worker.XXXXXX")"
  stdout_file="$temp_dir/stdout"
  stderr_file="$temp_dir/stderr"
  code_file="$temp_dir/exit-code"

  cleanup() {
    rm -rf "$temp_dir"
  }
  trap cleanup RETURN

  if [[ "$mode" == "inline" ]]; then
    set +e
    "$entrypoint" --worker-entry "$@" >"$stdout_file" 2>"$stderr_file"
    status=$?
    printf '%s' "$status" >"$code_file"
  else
    if ! search_worker_has_tmux; then
      if [[ "$mode" == "tmux" || "$mode" == "strict" ]]; then
        search_worker_error "tmux is not installed and SEARCH_WORKER_MODE=$mode requires it."
        return 127
      fi
      search_worker_warn "tmux not found; running search worker inline."
      set +e
      "$entrypoint" --worker-entry "$@" >"$stdout_file" 2>"$stderr_file"
      status=$?
      printf '%s' "$status" >"$code_file"
    else
      session="${session_prefix}-$$-$(date +%s)"
      inner_cmd="cd $(printf '%q' "$workdir"); set +e; "
      if [[ -f "$(search_worker_env_file)" ]]; then
        inner_cmd+="set -a; source $(printf '%q' "$(search_worker_env_file)"); set +a; "
      fi
      inner_cmd+="bash $(printf '%q' "$entrypoint") --worker-entry"
      for arg in "$@"; do
        inner_cmd+=" $(printf '%q' "$arg")"
      done
      inner_cmd+=" >$(printf '%q' "$stdout_file") 2>$(printf '%q' "$stderr_file"); status=\$?; printf '%s' \"\$status\" >$(printf '%q' "$code_file"); exit \"\$status\""

      tmux new-session -d -s "$session" "bash -lc $(printf '%q' "$inner_cmd")" >/dev/null

      deadline=$((SECONDS + timeout))
      while [[ ! -f "$code_file" ]]; do
        if (( SECONDS >= deadline )); then
          tmux kill-session -t "$session" >/dev/null 2>&1 || true
          search_worker_error "search worker timed out after ${timeout}s."
          return 124
        fi
        sleep 0.2
      done
      status="$(cat "$code_file")"
    fi
  fi

  if [[ -s "$stderr_file" ]]; then
    cat "$stderr_file" >&2
  fi
  if [[ -s "$stdout_file" ]]; then
    cat "$stdout_file"
  fi

  return "$status"
}
