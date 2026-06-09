#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
INSTALL_GLOBAL_SKILLS=false
INSTALL_PUBLISHED_PACKAGES=false
RESET_PI_GLOBALS=true
ASSUME_YES=false
SKIP_TOOLS=false
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY_RUN=true ;;
    --install-global-skills) INSTALL_GLOBAL_SKILLS=true ;;
    --install-published-packages) INSTALL_PUBLISHED_PACKAGES=true ;;
    --no-reset-pi) RESET_PI_GLOBALS=false ;;
    --yes|-y) ASSUME_YES=true ;;
    --skip-tools) SKIP_TOOLS=true ;;
    --install-third-party|--no-third-party) printf '⚠️  Third-party modifiers now lazy-install into ~/.local/share/nothing when used; %s is no longer needed.\n' "$arg" >&2 ;;
    --help|-h)
      cat <<'EOF'
Usage: ./bootstrap.sh [--dry-run] [--skip-tools] [--no-reset-pi] [--yes] [--install-global-skills] [--install-published-packages]

Fresh-machine bootstrap for nothing.

WARNING: this is my personal environment reset, not a general fork setup.
It archives/resets global Pi discovery dirs so plain `pi` starts factory-clean:
  ~/.pi/agent/{skills,extensions,prompts,themes}
  ~/.agents/skills
Do not run this on a shared/forked environment unless you want that reset.

Bootstrap also:
- installs baseline tools and Pi
- builds repo-local nothing packages for hat loading
- mounts nothing settings, mindsets, shell integration, and local hat wiring
- configures low-noise global git ignores and prints secrets/tooling guidance

Options:
  --dry-run, -n             Print commands without executing mutating steps.
  --skip-tools              Do not install baseline system packages with sudo.
  --no-reset-pi             Do not archive/reset global Pi discovery directories.
  --yes, -y                 Skip the destructive reset confirmation prompt.
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

TOTAL_STEPS=12
CURRENT_STEP=0

print_logo() {
  cat <<'EOF'
⠀⠀⠀⠀⣠⣤⣶⣶⣶⣤⣄⡀⠀
⠀⠀⣴⣾⣿⣿⣿⣿⣿⣧⡀⠈⠢
⠀⣼⣿⣿⣿⣿⣿⣿⣿⡿⠁⠀⠀
⢰⡿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀
⠘⣽⡿⠿⠿⣿⣿⣿⣿⣿⣦⣤⡀
⠀⣟⠀⠀⠀⣸⣿⡏⠀⠀⠀⢹⠗  𝗡𝗢𝗧𝗛𝟭𝗡𝗚𝗡𝗘𝗦𝗦
⠀⣿⣷⣶⣾⡿⠁⠙⣄⣀⣀⣠⡀
⠀⠙⠙⢿⡿⣷⣶⣤⣿⣿⡿⠿⠃
⠀⠀⠀⠺⡏⡏⡏⡏⡏⠉⠁⠀⠀
⠀⠀⠀⠀⠀⠀⠁⠁⠀⠀⠀⠀⠀
EOF
}

print_plan() {
  printf ':: transaction summary\n'
  printf '   reset pi globals      %s\n' "$([[ "$RESET_PI_GLOBALS" == true ]] && printf yes || printf no)"
  printf '   published packages    %s\n' "$([[ "$INSTALL_PUBLISHED_PACKAGES" == true ]] && printf yes || printf no)"
  printf '   global skill links    %s\n' "$([[ "$INSTALL_GLOBAL_SKILLS" == true ]] && printf yes || printf no)"
  printf '   third-party modifiers lazy cache\n'
  printf '   package source        checkout\n'
}

section() {
  printf '\n==> %s\n' "$*"
}

step() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  printf '\n==> [%02d/%02d] %s\n' "$CURRENT_STEP" "$TOTAL_STEPS" "$*"
}

info() { printf '  -> %s\n' "$*"; }
ok() { printf '  ✓ %s\n' "$*"; }
warn() { printf '  ! %s\n' "$*"; }

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

spin_run() {
  local label="$1"
  shift

  if [[ "$DRY_RUN" == true ]]; then
    run "$@"
    return
  fi

  if [[ ! -t 1 || -n "${CI:-}" ]]; then
    info "$label"
    "$@"
    return
  fi

  local tmp pid status frame i
  local -a frames=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
  tmp="$(mktemp)"

  "$@" >"$tmp" 2>&1 &
  pid=$!
  i=0
  while kill -0 "$pid" 2>/dev/null; do
    frame="${frames[$((i % ${#frames[@]}))]}"
    printf '\r  %s %s' "$frame" "$label"
    i=$((i + 1))
    sleep 0.1
  done

  if wait "$pid"; then
    status=0
  else
    status=$?
  fi

  if [[ $status -eq 0 ]]; then
    printf '\r  ✓ %s\n' "$label"
    rm -f "$tmp"
  else
    printf '\r  ✗ %s\n' "$label" >&2
    cat "$tmp" >&2
    rm -f "$tmp"
    return "$status"
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

ensure_sudo() {
  if [[ "$DRY_RUN" == true ]]; then
    printf '[dry-run] sudo -v # authenticate once for system package install\n'
    return
  fi
  if sudo -n true 2>/dev/null; then
    return
  fi
  info "Admin password required to install missing baseline tools."
  if ! sudo -v; then
    warn "sudo authentication failed. If you mistyped too many times, wait for the lockout to expire or check: faillock --user \"$USER\""
    exit 1
  fi
}

install_tools() {
  local required=(node npm tmux git gh go rsync jq)
  local missing=()
  local cmd
  for cmd in "${required[@]}"; do
    command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
  done

  if [[ ${#missing[@]} -eq 0 ]]; then
    ok "Baseline tools already installed; skipping system package install"
    return
  fi

  if [[ "$SKIP_TOOLS" == true ]]; then
    warn "Skipping system package install; missing tools: ${missing[*]}"
    return
  fi

  info "Missing baseline tools: ${missing[*]}"

  local os
  os="$(uname -s)"
  case "$os" in
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        info "Installing baseline tools via Homebrew..."
        spin_run "Installing baseline tools with Homebrew" brew install node tmux git gh go rsync jq
      else
        warn "Homebrew not found. Install node, npm, git, gh, go, rsync, jq, and tmux manually."
      fi
      ;;
    Linux)
      if [[ -f /etc/arch-release ]] || command -v pacman >/dev/null 2>&1; then
        ensure_sudo
        info "Installing baseline tools via pacman..."
        spin_run "Installing baseline tools with pacman" sudo pacman -S --needed --noconfirm nodejs npm tmux git github-cli go rsync jq
      elif command -v apt-get >/dev/null 2>&1; then
        ensure_sudo
        info "Installing baseline tools via apt-get..."
        spin_run "Refreshing apt package indexes" sudo apt-get update
        spin_run "Installing baseline tools with apt-get" sudo apt-get install -y nodejs npm tmux git gh golang rsync jq
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
  if [[ -f "$SCRIPT_DIR/package-lock.json" ]]; then
    spin_run "Installing workspace dependencies with npm ci" npm ci --include=dev
  else
    spin_run "Installing workspace dependencies with npm" npm install --include=dev
  fi

  info "Building local workspace packages..."
  spin_run "Building workspace packages" npm run build --workspaces --if-present

  if [[ "$DRY_RUN" == true ]]; then
    for pkg in noagy nofooter noleaks nosearch notrace; do
      printf '[dry-run] verify %s\n' "$SCRIPT_DIR/packages/$pkg/dist/$pkg.js"
    done
    return
  fi

  local missing=()
  for pkg in noagy nofooter noleaks nosearch notrace; do
    if [[ ! -f "$SCRIPT_DIR/packages/$pkg/dist/$pkg.js" ]]; then
      missing+=("packages/$pkg/dist/$pkg.js")
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
  run find "$SCRIPT_DIR/packages" "$SCRIPT_DIR/scripts" -type f \( -name '*.sh' -o -name '*.cjs' \) -exec chmod +x {} \;
}

reset_global_dir() {
  local target="$1" label="$2" backup_root="$3"
  case "$target" in
    "$AGENT_DIR/skills"|"$AGENT_DIR/extensions"|"$AGENT_DIR/prompts"|"$AGENT_DIR/themes"|"$HOME/.agents/skills") ;;
    *) echo "Refusing unsafe reset path: $target" >&2; exit 1 ;;
  esac

  local should_archive=false
  if [[ -L "$target" || -f "$target" ]]; then
    should_archive=true
  elif [[ -d "$target" ]]; then
    local first_entry
    first_entry="$(find "$target" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null || true)"
    [[ -n "$first_entry" ]] && should_archive=true
  elif [[ -e "$target" ]]; then
    should_archive=true
  fi

  if [[ "$should_archive" == true ]]; then
    local backup="$backup_root/$label"
    run mkdir -p "$backup_root"
    run mv "$target" "$backup"
    warn "Archived existing $label from $target to $backup"
  elif [[ -d "$target" ]]; then
    ok "$label already empty"
  fi

  run mkdir -p "$target"
}

reset_pi_global_discovery() {
  local stamp backup_root
  stamp="$(date +%Y%m%d-%H%M%S)-$$"
  backup_root="$HOME/.local/share/nothing/pi-reset-backups/$stamp"

  info "Resetting Pi globals so plain 'pi' starts factory-clean..."
  reset_global_dir "$AGENT_DIR/skills" "pi-skills" "$backup_root"
  reset_global_dir "$AGENT_DIR/extensions" "pi-extensions" "$backup_root"
  reset_global_dir "$AGENT_DIR/prompts" "pi-prompts" "$backup_root"
  reset_global_dir "$AGENT_DIR/themes" "pi-themes" "$backup_root"
  reset_global_dir "$HOME/.agents/skills" "agents-skills" "$backup_root"
}

confirm_personal_reset() {
  if [[ "$DRY_RUN" == true || "$RESET_PI_GLOBALS" != true || "$ASSUME_YES" == true ]]; then
    return
  fi

  section "☠☣☢  𝗗𝗘𝗦𝗧𝗥𝗨𝗖𝗧𝟭𝗩𝗘 𝗣𝗜 𝗖𝗢𝗗𝟭𝗡𝗚 𝗔𝗚𝗘𝗡𝗧 𝗥𝗘𝗦𝗘𝗧 ☠☣☢ <=="
  printf '\nThis will archive and recreate these global discovery directories:\n\n' >&2
  printf '  %s/skills\n' "$AGENT_DIR" >&2
  printf '  %s/extensions\n' "$AGENT_DIR" >&2
  printf '  %s/prompts\n' "$AGENT_DIR" >&2
  printf '  %s/themes\n' "$AGENT_DIR" >&2
  printf '  %s/.agents/skills\n\n' "$HOME" >&2
  printf 'Backups will be stored under:\n\n' >&2
  printf '  %s/.local/share/nothing/pi-reset-backups/<timestamp>\n\n' "$HOME" >&2
  printf 'Plain `pi` will start factory-clean after this.\n' >&2
  printf 'Use --no-reset-pi to skip this step.\n\n' >&2

  if [[ ! -t 0 ]]; then
    printf 'Refusing to continue without an interactive confirmation. Use --yes only if you really mean it.\n' >&2
    exit 1
  fi

  local answer
  printf 'Continue? [y/N]: ' >&2
  read -r answer
  case "$answer" in
    y|Y|yes|YES|Yes)
      ok "Confirmed reset"
      ;;
    *)
      printf 'Aborted. Nothing was changed.\n' >&2
      exit 1
      ;;
  esac
}

printf '\n'
print_logo
print_plan

if [[ "$DRY_RUN" == true || "$RESET_PI_GLOBALS" != true || "$ASSUME_YES" == true ]]; then
  printf '\n'
  printf '  ! PERSONAL RESET: archives global Pi skills/extensions/prompts/themes and ~/.agents/skills.\n'
  printf '  ! Forkers/shared machines: do not run this unless you want your agent environment reset.\n'
fi

confirm_personal_reset

step "Resolve baseline system dependencies"
install_tools

step "Synchronize workspace dependencies and build packages"
build_local_packages

step "Validate npm global prefix"
ensure_npm_global_prefix

step "Install Pi coding agent package"
spin_run "Installing @earendil-works/pi-coding-agent" npm install -g @earendil-works/pi-coding-agent

step "Process optional published @raquezha packages"
if [[ "$INSTALL_PUBLISHED_PACKAGES" == true ]]; then
  spin_run "Installing published @raquezha packages" npm install -g @raquezha/notrace @raquezha/noleaks @raquezha/nosearch @raquezha/noagy @raquezha/nofooter @raquezha/norpiv
else
  info "Skipping published package install; hats use this checkout's built packages."
fi
info "Skipping third-party global installs; --caveman and --rtk lazy-install local caches when used."

step "Prepare Pi agent filesystem"
run mkdir -p "$AGENT_DIR" "$HOME/.pi-secrets"
if [[ "$RESET_PI_GLOBALS" == true ]]; then
  reset_pi_global_discovery
else
  warn "Skipping Pi global reset; plain 'pi' may still load existing global resources."
  run mkdir -p "$AGENT_DIR/extensions" "$AGENT_DIR/skills" "$AGENT_DIR/prompts" "$AGENT_DIR/themes"
fi

step "Install Pi configuration files"
copy_file "$SCRIPT_DIR/settings.json" "$AGENT_DIR/settings.json" "settings.json"
copy_file "$SCRIPT_DIR/mindsets.json" "$AGENT_DIR/mindsets.json" "mindsets.json"

step "Process optional global skill links"
if [[ "$INSTALL_GLOBAL_SKILLS" == true ]]; then
  run node "$SCRIPT_DIR/packages/norpiv/bin/norpiv-install.cjs" --target pi
  run node "$SCRIPT_DIR/packages/nosearch/bin/nosearch-install.cjs" --target pi
else
  info "Skipping global skill links; hats load repo-local skills intentionally."
fi

step "Set executable bits for bundled helper scripts"
chmod_bundled_scripts

step "Configure global git ignore defaults"
ensure_global_gitignore

step "Install shell integration"
install_shell_integration

step "Check local secret environment"
if [[ -f "$SECRETS_FILE" ]]; then
  ok "Found ~/.pi-secrets/.env"
  for var in GROQ_API_KEY BRAVE_SEARCH_API_KEY FIRECRAWL_API_TOKEN; do
    grep -Eq "^[[:space:]]*(export[[:space:]]+)?${var}=" "$SECRETS_FILE" 2>/dev/null || warn "$var missing from ~/.pi-secrets/.env"
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

section "Transaction complete"
ok "nothing setup finished"
printf '\n:: next steps\n'
printf '┌────────────┬──────────────────────────────────────────────────────────────────────────────┐\n'
printf '│ %-10s │ %-76.76s │\n' "action" "command"
printf '├────────────┼──────────────────────────────────────────────────────────────────────────────┤\n'
printf '│ %-10s │ %-76.76s │\n' "reload" "source $SCRIPT_DIR/dotfiles/shell_integration.sh"
printf '│ %-10s │ %-76.76s │\n' "start" "pi"
printf '│ %-10s │ %-76.76s │\n' "hats" "pi --nothing | --pm | --dev | --rpiv | --android | --meta"
printf '│ %-10s │ %-76.76s │\n' "more hats" "pi --antigravity"
printf '│ %-10s │ %-76.76s │\n' "modifiers" "pi --rpiv --caveman | pi --android --caveman | pi --android --rtk"
printf '│ %-10s │ %-76.76s │\n' "rpiv" "packages/norpiv/scripts/"
printf '└────────────┴──────────────────────────────────────────────────────────────────────────────┘\n'
printf '\n   note: --caveman and --rtk lazy-install local caches on first use.\n\n'
