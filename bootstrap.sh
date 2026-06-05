#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY_RUN=true ;;
    --help|-h)
      cat <<'EOF'
Usage: ./bootstrap.sh [--dry-run]

Fresh-machine bootstrap for nothing:
- installs baseline tools and Pi
- installs published nothing extensions from npm
- mounts nothing settings, mindsets, shell integration, and bundled skills
- configures low-noise global git ignores and prints secrets/tooling guidance

Options:
  --dry-run, -n  Print commands without executing mutating steps.
  --help, -h     Show this help.
EOF
      exit 0
      ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$HOME/.pi/agent"
SECRETS_FILE="$HOME/.pi-secrets/.env"

info() { printf '▸ %s\n' "$*"; }
ok() { printf '✅ %s\n' "$*"; }
warn() { printf '⚠️  %s\n' "$*"; }

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

link_item() {
  local src="$1" dest="$2" label="$3"
  if [[ ! -e "$src" ]]; then
    warn "Skipping $label (missing source: $src)"
    return
  fi
  run mkdir -p "$(dirname "$dest")"
  if [[ -e "$dest" && ! -L "$dest" ]]; then
    local backup
    backup="$dest.backup.$(date +%s)"
    run mv "$dest" "$backup"
    warn "Backed up existing $label to $backup"
  fi
  if [[ -L "$dest" ]]; then
    local current
    current="$(readlink "$dest")"
    if [[ "$current" == "$src" ]]; then
      ok "$label already linked"
      return
    fi
    run rm "$dest"
  fi
  run ln -s "$src" "$dest"
  ok "Linked $label"
}

copy_file() {
  local src="$1" dest="$2" label="$3"
  if [[ ! -f "$src" ]]; then
    warn "Skipping $label (missing source: $src)"
    return
  fi
  run mkdir -p "$(dirname "$dest")"
  if [[ -e "$dest" && ! -L "$dest" ]]; then
    run cp "$dest" "$dest.backup.$(date +%s)"
    warn "Backed up existing $label"
  fi
  run cp "$src" "$dest"
  ok "Installed $label"
}

ensure_global_gitignore() {
  local file="$HOME/.gitignore_global"
  run touch "$file"
  run git config --global core.excludesfile "$file"
  for entry in ".workflow/" ".pi-settings.json" ".pi-models.json" ".pi-*.json"; do
    if [[ "$DRY_RUN" == true ]]; then
      grep -qxF "$entry" "$file" 2>/dev/null || printf '[dry-run] append %s to %s\n' "$entry" "$file"
    elif ! grep -qxF "$entry" "$file" 2>/dev/null; then
      printf '\n%s\n' "$entry" >> "$file"
      ok "Added $entry to ~/.gitignore_global"
    fi
  done
}

install_shell_integration() {
  local rc=""
  if [[ -f "$HOME/.zshrc" || "${SHELL:-}" == */zsh ]]; then
    rc="$HOME/.zshrc"
  else
    rc="$HOME/.bashrc"
  fi
  local line="[ -f $SCRIPT_DIR/dotfiles/shell_integration.sh ] && source $SCRIPT_DIR/dotfiles/shell_integration.sh"
  run touch "$rc"
  if [[ "$DRY_RUN" == true ]]; then
    grep -qF "$line" "$rc" 2>/dev/null || printf '[dry-run] append shell integration to %s\n' "$rc"
  elif grep -qF "$line" "$rc" 2>/dev/null; then
    ok "Shell integration already installed in $(basename "$rc")"
  else
    printf '\n# nothing shell integration\n%s\n' "$line" >> "$rc"
    ok "Added nothing shell integration to $(basename "$rc")"
  fi
}

install_tools() {
  local os
  os="$(uname -s)"
  case "$os" in
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        info "Installing baseline tools via Homebrew..."
        run brew install node tmux git gh go rsync jq
      else
        warn "Homebrew not found. Install node, npm, git, gh, go, rsync, jq, and tmux manually."
      fi
      ;;
    Linux)
      if [[ -f /etc/arch-release ]] || command -v pacman >/dev/null 2>&1; then
        info "Installing baseline tools via pacman..."
        run sudo pacman -S --needed --noconfirm nodejs npm tmux git github-cli go rsync jq
      elif command -v apt-get >/dev/null 2>&1; then
        info "Installing baseline tools via apt-get..."
        run sudo apt-get update
        run sudo apt-get install -y nodejs npm tmux git gh golang rsync jq
      else
        warn "Unsupported Linux package manager. Install node, npm, tmux, git, gh, go, rsync, and jq manually."
      fi
      ;;
    *) warn "Unsupported OS: $os. Continuing with repo setup only." ;;
  esac
}

printf '\n╔══════════════════════════════════════╗\n'
printf '║       nothing fresh bootstrap        ║\n'
printf '╚══════════════════════════════════════╝\n\n'

install_tools

info "Installing Pi coding agent globally..."
run npm install -g @earendil-works/pi-coding-agent

info "Installing published nothing extensions globally..."
run npm install -g @raquezha/notrace @raquezha/noleaks @raquezha/nosearch @raquezha/noagy @raquezha/nofooter

info "Creating Pi agent directories..."
run mkdir -p "$AGENT_DIR/extensions" "$AGENT_DIR/skills" "$AGENT_DIR/prompts" "$AGENT_DIR/themes" "$HOME/.pi-secrets"

info "Installing config defaults..."
copy_file "$SCRIPT_DIR/settings.json" "$AGENT_DIR/settings.json" "settings.json"
copy_file "$SCRIPT_DIR/mindsets.json" "$AGENT_DIR/mindsets.json" "mindsets.json"

info "Installing bundled skills for global discovery..."
run node "$SCRIPT_DIR/packages/norpiv/bin/norpiv-install.cjs" --target pi
run node "$SCRIPT_DIR/packages/nosearch/bin/nosearch-install.cjs" --target pi

info "Preparing bundled helper scripts..."
run chmod +x "$SCRIPT_DIR/packages/norpiv/scripts/triage_helper.sh" "$SCRIPT_DIR/packages/norpiv/scripts/validate_active_task.sh"
run chmod +x "$SCRIPT_DIR/packages/norpiv/implement/scripts/enforce-branch.sh"
run find "$SCRIPT_DIR/packages/nosearch" -name '*.sh' -exec chmod +x {} \;

info "Configuring global git ignore defaults..."
ensure_global_gitignore

info "Installing shell integration..."
install_shell_integration

info "Checking secrets..."
if [[ -f "$SECRETS_FILE" ]]; then
  ok "Found ~/.pi-secrets/.env"
  grep -q "BRAVE_SEARCH_API_KEY" "$SECRETS_FILE" 2>/dev/null || warn "BRAVE_SEARCH_API_KEY missing from ~/.pi-secrets/.env"
  grep -q "ANTIGRAVITY_CLIENT_SECRET" "$SECRETS_FILE" 2>/dev/null || warn "ANTIGRAVITY_CLIENT_SECRET missing from ~/.pi-secrets/.env"
else
  warn "No ~/.pi-secrets/.env found"
  cat <<'EOF'
Create it when ready:
  mkdir -p ~/.pi-secrets && chmod 700 ~/.pi-secrets
  $EDITOR ~/.pi-secrets/.env
  chmod 600 ~/.pi-secrets/.env
EOF
fi

printf '\n✅ Bootstrap complete! 🎉\n\n'
printf 'Next steps:\n'
printf '  1. Reload your shell or run: source %s/dotfiles/shell_integration.sh\n' "$SCRIPT_DIR"
printf '  2. Start Pi normally: pi\n'
printf '  3. Use hats: pi --pm, pi --dev, pi --rpiv, pi --meta, pi --antigravity\n'
printf '  4. RPIV helper scripts live at: packages/norpiv/scripts/\n\n'
