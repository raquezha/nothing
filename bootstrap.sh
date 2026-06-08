#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
INSTALL_GLOBAL_SKILLS=false
INSTALL_PUBLISHED_PACKAGES=false
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY_RUN=true ;;
    --install-global-skills) INSTALL_GLOBAL_SKILLS=true ;;
    --install-published-packages) INSTALL_PUBLISHED_PACKAGES=true ;;
    --install-third-party|--no-third-party) printf '⚠️  Third-party modifiers now lazy-install into ~/.local/share/nothing when used; %s is no longer needed.\n' "$arg" >&2 ;;
    --help|-h)
      cat <<'EOF'
Usage: ./bootstrap.sh [--dry-run] [--install-global-skills] [--install-published-packages]

Fresh-machine bootstrap for nothing:
- installs baseline tools and Pi
- builds repo-local nothing packages for hat loading
- mounts nothing settings, mindsets, shell integration, and local hat wiring
- configures low-noise global git ignores and prints secrets/tooling guidance

Options:
  --dry-run, -n             Print commands without executing mutating steps.
  --install-global-skills      Also link bundled skills into ~/.pi/agent/skills.
                               Default is local-first: hats load repo-local skills only.
  --install-published-packages Install published @raquezha packages globally with npm.
                               Default uses this checkout's built packages instead.
  --install-third-party        Deprecated no-op; third-party modifiers lazy-install locally.
  --no-third-party             Deprecated no-op; third-party modifiers lazy-install locally.
  --help, -h                Show this help.
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

merge_json_defaults() {
  local src="$1" dest="$2" label="$3"
  if [[ ! -f "$src" ]]; then
    warn "Skipping $label (missing source: $src)"
    return
  fi
  run mkdir -p "$(dirname "$dest")"
  if [[ -e "$dest" && ! -L "$dest" ]]; then
    run cp "$dest" "$dest.backup.$(date +%s)"
    warn "Backed up existing $label"
    if [[ "$DRY_RUN" == true ]]; then
      printf '[dry-run] merge defaults from %s into %s preserving existing keys\n' "$src" "$dest"
    else
      node -e "
        const fs = require('fs');
        const [src, dest] = process.argv.slice(1);
        const defaults = JSON.parse(fs.readFileSync(src, 'utf8'));
        const existing = JSON.parse(fs.readFileSync(dest, 'utf8'));
        fs.writeFileSync(dest, JSON.stringify({ ...defaults, ...existing }, null, 2) + '\n');
      " "$src" "$dest"
    fi
  else
    run cp "$src" "$dest"
  fi
  ok "Installed $label"
}

ensure_global_gitignore() {
  local file
  file="$(git config --global --get core.excludesfile 2>/dev/null || true)"
  if [[ -z "$file" ]]; then
    file="$HOME/.gitignore_global"
    run git config --global core.excludesfile "$file"
  fi
  file="${file/#\~/$HOME}"
  run touch "$file"
  for entry in ".workflow/" ".reposcry/" ".pi-settings.json" ".pi-models.json" ".pi-*.json"; do
    if [[ "$DRY_RUN" == true ]]; then
      grep -qxF "$entry" "$file" 2>/dev/null || printf '[dry-run] append %s to %s\n' "$entry" "$file"
    elif ! grep -qxF "$entry" "$file" 2>/dev/null; then
      printf '\n%s\n' "$entry" >> "$file"
      ok "Added $entry to $file"
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

ensure_npm_global_prefix() {
  local prefix user_prefix
  prefix="$(npm config get prefix 2>/dev/null || true)"
  prefix="${prefix/#\~/$HOME}"
  if [[ -z "$prefix" || "$prefix" == "undefined" || -w "$prefix" ]]; then
    return
  fi

  user_prefix="$HOME/.local"
  warn "npm global prefix is not writable ($prefix); using user prefix $user_prefix"
  run mkdir -p "$user_prefix"
  run npm config set prefix "$user_prefix"
  case ":$PATH:" in
    *":$user_prefix/bin:"*) ;;
    *) warn "Ensure $user_prefix/bin is on PATH before running global npm commands." ;;
  esac
}

build_local_packages() {
  info "Installing local workspace dependencies..."
  run npm install --include=dev

  info "Building local workspace packages..."
  run npm run build --workspaces --if-present

  if [[ "$DRY_RUN" == true ]]; then
    for pkg in noagy nofooter noleaks nosearch notrace; do
      printf '[dry-run] verify %s\n' "$SCRIPT_DIR/packages/$pkg/dist/index.js"
    done
    return
  fi

  local missing=()
  for pkg in noagy nofooter noleaks nosearch notrace; do
    if [[ ! -f "$SCRIPT_DIR/packages/$pkg/dist/index.js" ]]; then
      missing+=("packages/$pkg/dist/index.js")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    printf 'Missing built extension outputs:\n' >&2
    printf '  - %s\n' "${missing[@]}" >&2
    exit 1
  fi
  ok "Local extension build outputs verified"
}

chmod_bundled_scripts() {
  info "Preparing bundled helper scripts..."
  run find "$SCRIPT_DIR/packages" "$SCRIPT_DIR/scripts" -type f \( -name '*.sh' -o -name '*.cjs' \) -exec chmod +x {} \;
}

printf '\n╔══════════════════════════════════════╗\n'
printf '║       nothing fresh bootstrap        ║\n'
printf '╚══════════════════════════════════════╝\n\n'

install_tools
build_local_packages

ensure_npm_global_prefix
info "Installing Pi coding agent globally..."
run npm install -g @earendil-works/pi-coding-agent

if [[ "$INSTALL_PUBLISHED_PACKAGES" == true ]]; then
  info "Installing published nothing packages globally..."
  run npm install -g @raquezha/notrace @raquezha/noleaks @raquezha/nosearch @raquezha/noagy @raquezha/nofooter @raquezha/norpiv
else
  info "Skipping published @raquezha package install; hats use this checkout's built packages."
fi

info "Skipping third-party global installs; --caveman and --rtk lazy-install local caches when used."

info "Creating Pi agent directories..."
run mkdir -p "$AGENT_DIR/extensions" "$AGENT_DIR/skills" "$AGENT_DIR/prompts" "$AGENT_DIR/themes" "$HOME/.pi-secrets"

info "Installing config defaults..."
merge_json_defaults "$SCRIPT_DIR/settings.json" "$AGENT_DIR/settings.json" "settings.json"
copy_file "$SCRIPT_DIR/mindsets.json" "$AGENT_DIR/mindsets.json" "mindsets.json"

if [[ "$INSTALL_GLOBAL_SKILLS" == true ]]; then
  info "Linking bundled local skills for optional global discovery..."
  run node "$SCRIPT_DIR/packages/norpiv/bin/norpiv-install.cjs" --target pi
  run node "$SCRIPT_DIR/packages/nosearch/bin/nosearch-install.cjs" --target pi
else
  info "Skipping global skill links; hats load repo-local skills intentionally."
fi

chmod_bundled_scripts

info "Configuring global git ignore defaults..."
ensure_global_gitignore

info "Installing shell integration..."
install_shell_integration

info "Checking secrets..."
if [[ -f "$SECRETS_FILE" ]]; then
  ok "Found ~/.pi-secrets/.env"
  for var in GROQ_API_KEY BRAVE_SEARCH_API_KEY FIRECRAWL_API_TOKEN; do
    grep -Eq "^[[:space:]]*(export[[:space:]]+)?${var}=" "$SECRETS_FILE" 2>/dev/null || warn "$var missing from ~/.pi-secrets/.env"
  done
  for var in NOAGY_CLIENT_ID NOAGY_CLIENT_SECRET NOAGY_PROJECT_ID; do
    grep -Eq "^[[:space:]]*(export[[:space:]]+)?${var}=" "$SECRETS_FILE" 2>/dev/null || warn "Optional $var missing from ~/.pi-secrets/.env"
  done
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
printf '  3. Use hats: pi --nothing, pi --pm, pi --dev, pi --rpiv, pi --android, pi --meta, pi --antigravity\n'
printf '  4. Use modifiers: pi --rpiv --caveman, pi --android --caveman, pi --android --rtk\n'
printf '     (--caveman and --rtk lazy-install local caches on first use.)\n'
printf '  5. RPIV helper scripts live at: packages/norpiv/scripts/\n\n'
