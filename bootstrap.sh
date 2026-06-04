#!/usr/bin/env bash
set -euo pipefail

# 1. Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin)
    echo "Installing system packages via Homebrew..."
    brew install node tmux git gh go
    ;;
  Linux)
    echo "Detecting Linux package manager..."
    if command -v apt-get &>/dev/null; then
      sudo apt-get update && sudo apt-get install -y nodejs npm tmux git github-cli golang
    elif command -v pacman &>/dev/null; then
      sudo pacman -S --noconfirm nodejs npm tmux git github-cli go
    else
      echo "Unsupported Linux package manager. Please make sure node, npm, tmux, git, and gh are installed."
    fi
    ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

# 2. Install Pi Agent and 'something' extension globally
echo "Installing Pi coding agent globally..."
npm install -g @mariozechner/pi-coding-agent

echo "Installing 'notrace' trace extension globally..."
npm install -g notrace

# 3. Apply settings
mkdir -p "$HOME/.pi/agent"
cp settings.json "$HOME/.pi/agent/settings.json"

echo "Bootstrapping complete! 🎉"
