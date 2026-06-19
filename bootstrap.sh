#!/usr/bin/env bash
set -euo pipefail

# Setup paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

DRY_RUN=false
INSTALL_GLOBAL_SKILLS=false
INSTALL_PUBLISHED_PACKAGES=false
RESET_PI_GLOBALS=true
ASSUME_YES=false
SKIP_TOOLS=false
INSTALL_HEADROOM=false
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY_RUN=true ;;
    --headroom) INSTALL_HEADROOM=true ;;
    --install-global-skills) INSTALL_GLOBAL_SKILLS=true ;;
    --install-published-packages) INSTALL_PUBLISHED_PACKAGES=true ;;
    --no-reset-pi) RESET_PI_GLOBALS=false ;;
    --yes|-y) ASSUME_YES=true ;;
    --skip-tools) SKIP_TOOLS=true ;;
    --pulse)
      printf '\n\x1b[1m\x1b[38;5;208m[nothing] Environment Pulse\x1b[0m\n'
      printf '\x1b[38;5;244m--------------------------------------------------\x1b[0m\n'
      RS_BOOTSTRAP="$SCRIPT_DIR/packages/norpiv/scripts/reposcry-bootstrap.sh"
      if [[ -f "$RS_BOOTSTRAP" ]]; then
        PULSE=$(bash "$RS_BOOTSTRAP" --pulse)
        printf '\x1b[1mRepoScry:\x1b[0m    %s\n' "${PULSE#PULSE: }"
      fi
      if command -v docker >/dev/null 2>&1; then
        if docker ps --format '{{.Names}}' | grep -q "headroom"; then
          printf '\x1b[1mHeadroom:\x1b[0m    \x1b[32mOnline\x1b[0m\n'
        else
          printf '\x1b[1mHeadroom:\x1b[0m    \x1b[31mOffline\x1b[0m\n'
        fi
      fi
      NT_INDEX="$REPO_ROOT/.notrace/index.json"
      if [[ -f "$NT_INDEX" ]]; then
        SESSIONS=$(jq '.sessions | length' "$NT_INDEX")
        printf '\x1b[1mNotrace:\x1b[0m     \x1b[32mActive\x1b[0m (%d sessions)\n' "$SESSIONS"
      fi
      ACTIVE_TASK="$REPO_ROOT/.workflow/active_task.json"
      if [[ -f "$ACTIVE_TASK" ]]; then
        TASK_ID=$(jq -r '.active_task // "none"' "$ACTIVE_TASK")
        printf '\x1b[1mActive Task:\x1b[0m %s\n' "$TASK_ID"
      fi
      printf '\x1b[38;5;244m--------------------------------------------------\x1b[0m\n'
      exit 0
      ;;
    --install-third-party|--no-third-party) printf '⚠️  Third-party modifiers now lazy-install into ~/.local/share/nothing when used; %s is no longer needed.\n' "$arg" >&2 ;;
    --help|-h)
      cat <<'EOF'
Usage: ./bootstrap.sh [--dry-run] [--skip-tools] [--no-reset-pi] [--yes] [--headroom] [--install-global-skills] [--install-published-packages]

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
  --headroom                Configure local Headroom Docker backend and install proof-phase Pi extension.
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
  printf '   headroom backend     %s\n' "$([[ "$INSTALL_HEADROOM" == true ]] && printf yes || printf no)"
  printf '   package source        checkout\n'
  printf '   global AGENTS.md      bootstrap-managed\n'
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

install_global_agents_md() {
  local dest="$HOME/AGENTS.md"
  local src="$SCRIPT_DIR/config/AGENTS.md"
  local backup
  if [[ "$DRY_RUN" == true ]]; then
    if [[ -e "$dest" ]]; then
      printf '[dry-run] back up existing %s if needed and install global AGENTS guardrails (with local discovery)\n' "$dest"
    else
      printf '[dry-run] install global AGENTS guardrails at %s (with local discovery)\n' "$dest"
    fi
    return
  fi

  if [[ ! -f "$src" ]]; then
    warn "Skipping global AGENTS.md (missing source: $src)"
    return
  fi

  # Discovery: Netdata
  local netdata_port=""
  local netdata_info=""
  for p in 19998 19999; do
    if curl -fsS "http://127.0.0.1:$p/api/v1/info" &>/dev/null; then
      netdata_port="$p"
      break
    fi
  done

  if [[ -n "$netdata_port" ]]; then
    netdata_info="Netdata is active on port $netdata_port. Use these templates:
\`\`\`bash
curl -fsS http://127.0.0.1:$netdata_port/api/v1/info | head -c 500
curl -fsS 'http://127.0.0.1:$netdata_port/api/v1/data?chart=NAME&after=-3d&before=0&format=json' | head -c 800
\`\`\`"
  else
    netdata_info="Netdata is not detected on this machine. Do not attempt to use Netdata tools."
  fi

  if [[ -L "$dest" ]]; then
    run rm "$dest"
    warn "Replaced existing AGENTS.md symlink at $dest"
  elif [[ -e "$dest" ]]; then
    backup="$dest.backup.$(date +%s)"
    run cp "$dest" "$backup"
    warn "Backed up existing global AGENTS.md to $backup"
  fi

  # Use node for robust multiline replacement
  node -e '
    const fs = require("fs");
    const src = process.argv[1];
    const dest = process.argv[2];
    const info = process.argv[3];
    let content = fs.readFileSync(src, "utf8");
    content = content.replace("{{NETDATA_INSTRUCTIONS}}", info);
    fs.writeFileSync(dest, content);
  ' "$src" "$dest" "$netdata_info"

  ok "Installed global AGENTS.md guardrails with machine-specific discovery"
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

  local pkg output
  local outputs=(
    "antigravity:dist/antigravity/index.js"
    "nofooter:dist/nofooter.js"
    "noleaks:dist/noleaks/index.js"
    "noheadroom:dist/index.js"
    "nosearch:dist/nosearch.js"
    "notrace:dist/notrace/index.js"
  )

  if [[ "$DRY_RUN" == true ]]; then
    for entry in "${outputs[@]}"; do
      pkg="${entry%%:*}"
      output="${entry#*:}"
      printf '[dry-run] verify %s\n' "$SCRIPT_DIR/packages/$pkg/$output"
    done
    return
  fi

  local missing=()
  for entry in "${outputs[@]}"; do
    pkg="${entry%%:*}"
    output="${entry#*:}"
    if [[ ! -f "$SCRIPT_DIR/packages/$pkg/$output" ]]; then
      missing+=("packages/$pkg/$output")
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

configure_headroom() {
  local settings_dir="$AGENT_DIR/headroom"
  local settings_file="$settings_dir/settings.json"

  info "Configuring Headroom Docker backend and local noheadroom Pi extension..."
  run mkdir -p "$settings_dir"
  copy_file "$SCRIPT_DIR/headroom/settings.json.example" "$settings_file" "headroom/settings.json"

  if [[ "$DRY_RUN" == true ]]; then
    printf '[dry-run] %s\n' "$SCRIPT_DIR/scripts/headroom-up.sh"
    printf '[dry-run] local noheadroom extension will load through --headroom/--tkmx shell modifiers\n'
    return
  fi

  if ! command -v docker >/dev/null 2>&1; then
    warn "Docker not found; Headroom backend not started. Install Docker or run scripts/headroom-up.sh later."
  else
    spin_run "Starting Headroom Docker backend" "$SCRIPT_DIR/scripts/headroom-up.sh"
  fi

  info "Using repo-local packages/noheadroom through --headroom/--tkmx shell modifiers."
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
  spin_run "Installing published @raquezha packages" npm install -g @raquezha/notrace @raquezha/noleaks @raquezha/nosearch @raquezha/antigravity @raquezha/nofooter @raquezha/norpiv
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
copy_file "$SCRIPT_DIR/config/settings.json" "$AGENT_DIR/settings.json" "settings.json"
copy_file "$SCRIPT_DIR/config/mindsets.json" "$AGENT_DIR/mindsets.json" "mindsets.json"
copy_file "$SCRIPT_DIR/config/themes/dracula-vibrant.json" "$AGENT_DIR/themes/dracula-vibrant.json" "themes/dracula-vibrant.json"
if [[ "$INSTALL_HEADROOM" == true ]]; then
  configure_headroom
else
  info "Skipping Headroom setup; use --headroom to configure Docker backend and proof-phase extension."
fi

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

step "Install global AGENTS.md guardrails"
install_global_agents_md

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
printf '│ %-10s │ %-76.76s │\n' "updates" "pi --android-update refreshes local Android CLI skill cache"
printf '│ %-10s │ %-76.76s │\n' "more hats" "pi --write | --notes | --antigravity"
printf '│ %-10s │ %-76.76s │\n' "modifiers" "pi --rpiv --caveman | --rtk | --headroom | --notrace | --ponytail"
printf '│ %-10s │ %-76.76s │\n' "combo" "pi --tkmx (caveman + rtk + headroom + notrace + ponytail)"
printf '│ %-10s │ %-76.76s │\n' "rpiv" "packages/norpiv/scripts/"
printf '└────────────┴──────────────────────────────────────────────────────────────────────────────┘\n'
printf '\n   note: --caveman, --rtk, and --ponytail lazy-install local caches on first use.\n'
printf '   note: --headroom starts the local Headroom Docker backend on demand.\n'
printf '   note: plain `pi` keeps the noleaks guard on by default, regardless of mindset.\n\n'
