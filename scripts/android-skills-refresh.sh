#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_ROOT="${NOTHING_CACHE_DIR:-$HOME/.local/share/nothing}"
CACHE_DIR="${ANDROID_SKILLS_CACHE_DIR:-$CACHE_ROOT/android-skills}"
INSTALL_CLI=false

usage() {
  cat <<'EOF'
Usage: scripts/android-skills-refresh.sh [--install-cli]

Refresh the local Android CLI skills cache used by `pi --android`.

Default behavior:
  - requires an existing `android` command
  - runs `android update`
  - runs `android skills add --all --project=<temp project>`
  - verifies `skills/android-cli/SKILL.md`
  - atomically swaps the local cache

Options:
  --install-cli  Download and run the official Android CLI installer first.
  --help         Show this help.
EOF
}

android_install_url() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os:$arch" in
    Linux:x86_64|Linux:amd64)
      printf '%s\n' 'https://dl.google.com/android/cli/latest/linux_x86_64/install.sh'
      ;;
    Darwin:arm64)
      printf '%s\n' 'https://dl.google.com/android/cli/latest/darwin_arm64/install.sh'
      ;;
    Darwin:x86_64)
      printf '%s\n' 'https://dl.google.com/android/cli/latest/darwin_x86_64/install.sh'
      ;;
    *)
      return 1
      ;;
  esac
}

print_install_command() {
  local url
  if url="$(android_install_url)"; then
    printf 'Install Android CLI, then rerun this refresh:\n'
    printf '  curl -fsSL %s | bash\n' "$url"
    printf 'Or run this script with explicit installer consent:\n'
    printf '  %s --install-cli\n' "$SCRIPT_DIR/android-skills-refresh.sh"
  else
    printf 'Unsupported OS/arch for automatic Android CLI command: %s %s\n' "$(uname -s)" "$(uname -m)"
  fi
}

install_android_cli() {
  local url installer
  url="$(android_install_url)" || {
    print_install_command >&2
    return 1
  }
  installer="$TMP_DIR/android-cli-install.sh"
  printf 'Downloading Android CLI installer from %s\n' "$url" >&2
  curl -fsSL "$url" -o "$installer"
  bash "$installer"
  export PATH="$HOME/.local/bin:$PATH"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-cli)
      INSTALL_CLI=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if ! command -v android >/dev/null 2>&1; then
  if [[ "$INSTALL_CLI" == true ]]; then
    install_android_cli
  else
    printf 'Android CLI is not installed.\n' >&2
    print_install_command >&2
    exit 1
  fi
fi

if ! command -v android >/dev/null 2>&1; then
  printf 'Android CLI still not found after install attempt.\n' >&2
  print_install_command >&2
  exit 1
fi

PROJECT_DIR="$TMP_DIR/project"
NEW_CACHE="$TMP_DIR/android-skills.new"
mkdir -p "$PROJECT_DIR" "$NEW_CACHE"

printf 'Updating Android CLI...\n' >&2
android update

printf 'Installing Android skills into temporary project...\n' >&2
if ! android skills add --all --project="$PROJECT_DIR"; then
  printf 'Failed to run: android skills add --all --project=<temp project>\n' >&2
  printf 'No cache was changed.\n' >&2
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/skills/android-cli/SKILL.md" ]]; then
  printf 'Expected Android CLI skill missing: %s\n' "$PROJECT_DIR/skills/android-cli/SKILL.md" >&2
  printf 'No cache was changed.\n' >&2
  exit 1
fi

mv "$PROJECT_DIR/skills" "$NEW_CACHE/skills"
cat > "$NEW_CACHE/.refreshed-at" <<EOF
$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
cat > "$NEW_CACHE/.source" <<'EOF'
android skills add --all --project=<temp project>
EOF

mkdir -p "$(dirname "$CACHE_DIR")"
BACKUP_DIR="$TMP_DIR/android-skills.previous"
if [[ -e "$CACHE_DIR" ]]; then
  mv "$CACHE_DIR" "$BACKUP_DIR"
fi
mv "$NEW_CACHE" "$CACHE_DIR"
rm -rf "$BACKUP_DIR"

COUNT="$(find "$CACHE_DIR/skills" -name SKILL.md | wc -l | tr -d ' ')"
printf 'Refreshed %s Android skills into %s\n' "$COUNT" "$CACHE_DIR"
