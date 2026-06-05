#!/usr/bin/env bash
set -euo pipefail

# 1. Detect OS Platform
OS="$(uname -s)"
case "$OS" in
  Darwin)
    echo "Installing tools via Homebrew..."
    brew install node tmux git gh go rsync
    ;;
  Linux)
    if [ -f /etc/arch-release ] || command -v pacman &>/dev/null; then
      echo "Installing tools via pacman..."
      sudo pacman -S --needed --noconfirm nodejs npm tmux git github-cli go rsync
    elif command -v apt-get &>/dev/null; then
      echo "Installing tools via apt-get..."
      sudo apt-get update && sudo apt-get install -y nodejs npm tmux git gh golang rsync
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
npm install -g @earendil-works/pi-coding-agent

echo "Installing nothing extensions globally from NPM..."
npm install -g @raquezha/notrace @raquezha/noleaks @raquezha/nosearch @raquezha/noagy @raquezha/nofooter

# 3. Mount configurations
mkdir -p "$HOME/.pi/agent"
cp settings.json "$HOME/.pi/agent/settings.json"
cp mindsets.json "$HOME/.pi/agent/mindsets.json"

echo "Bootstrap complete! 🎉"
