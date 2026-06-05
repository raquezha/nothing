#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n)
      DRY_RUN=true
      ;;
    --help|-h)
      cat <<'EOF'
Usage: ./bootstrap.sh [--dry-run]

Detects macOS/Linux, installs required tools, installs Pi + nothing extensions,
and mounts settings.json / mindsets.json into ~/.pi/agent.

Options:
  --dry-run, -n  Print commands without executing mutating steps.
  --help, -h     Show this help.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run() {
  if [[ "$DRY_RUN" == true ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

run_shell() {
  if [[ "$DRY_RUN" == true ]]; then
    printf '[dry-run] %s\n' "$*"
  else
    bash -c "$*"
  fi
}

# 1. Detect OS Platform
OS="$(uname -s)"
case "$OS" in
  Darwin)
    echo "Installing tools via Homebrew..."
    run brew install node tmux git gh go rsync
    ;;
  Linux)
    if [ -f /etc/arch-release ] || command -v pacman &>/dev/null; then
      echo "Installing tools via pacman..."
      run sudo pacman -S --needed --noconfirm nodejs npm tmux git github-cli go rsync
    elif command -v apt-get &>/dev/null; then
      echo "Installing tools via apt-get..."
      run sudo apt-get update
      run sudo apt-get install -y nodejs npm tmux git gh golang rsync
    else
      echo "Unsupported Linux package manager. Please install node, npm, tmux, git, gh, go, and rsync manually."
      exit 1
    fi
    ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

# 2. Install Pi Coding Agent and extensions globally from NPM
echo "Installing Pi coding agent globally..."
run npm install -g @earendil-works/pi-coding-agent

echo "Installing nothing extensions globally from NPM..."
run npm install -g @raquezha/notrace @raquezha/noleaks @raquezha/nosearch @raquezha/noagy @raquezha/nofooter

# 3. Mount configurations
run mkdir -p "$HOME/.pi/agent"
run cp "$SCRIPT_DIR/settings.json" "$HOME/.pi/agent/settings.json"
run cp "$SCRIPT_DIR/mindsets.json" "$HOME/.pi/agent/mindsets.json"

run_shell "test -f '$SCRIPT_DIR/settings.json' && test -f '$SCRIPT_DIR/mindsets.json'"

echo "Bootstrap complete! 🎉"
