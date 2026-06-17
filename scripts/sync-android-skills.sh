#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST="$ROOT_DIR/vendor/android-skills"
TMP="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP"
}
trap cleanup EXIT

# Ensure android-cli is installed
if ! command -v android &> /dev/null; then
  printf '▸ Android CLI not found. Installing...\n'
  OS="$(uname -s)"
  ARCH="$(uname -m)"
  if [[ "$OS" == "Darwin" && "$ARCH" == "arm64" ]]; then
    curl -fsSL https://dl.google.com/android/cli/latest/darwin_arm64/install.sh | bash
  elif [[ "$OS" == "Darwin" && "$ARCH" == "x86_64" ]]; then
    curl -fsSL https://dl.google.com/android/cli/latest/darwin_x86_64/install.sh | bash
  elif [[ "$OS" == "Linux" ]]; then
    curl -fsSL https://dl.google.com/android/cli/latest/linux_x86_64/install.sh | bash
  else
    echo "Unsupported OS/Arch: $OS $ARCH"
    exit 1
  fi
  export PATH="$HOME/.local/bin:$PATH"
fi

printf '▸ Extracting Android skills via android-cli...\n'
android skills add --all --project="$TMP" >/dev/null

rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$TMP/skills/"* "$DEST/"

count="$(find "$DEST" -name "SKILL.md" | wc -l | tr -d ' ')"
printf '✅ Synced %s Android skills into %s\n' "$count" "$DEST"
