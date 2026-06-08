#!/usr/bin/env bash
#
# nothing monorepo shell integration
# Supports bash and zsh because bootstrap sources this from .bashrc/.zshrc.
#

_nothing_shell_source=""
if [[ -n "${BASH_VERSION:-}" ]]; then
  _nothing_shell_source="${BASH_SOURCE[0]}"
elif [[ -n "${ZSH_VERSION:-}" ]]; then
  _nothing_shell_source="$(eval 'printf %s "${(%):-%x}"')"
else
  _nothing_shell_source="$0"
fi
_NOTHING_REPO_DIR="$(cd "$(dirname "$_nothing_shell_source")/.." && pwd)"
unset _nothing_shell_source

if [[ -d "$HOME/.local/bin" ]]; then
  case ":$PATH:" in
    *":$HOME/.local/bin:"*) ;;
    *) export PATH="$HOME/.local/bin:$PATH" ;;
  esac
fi

pi() {
  local NOTHING_DIR="$_NOTHING_REPO_DIR"
  local MINDSETS_JSON="$NOTHING_DIR/mindsets.json"
  local NOTHING_CACHE_DIR="${NOTHING_CACHE_DIR:-$HOME/.local/share/nothing}"

  export PI_MINDSET=""

  local -a ARGS=()
  local -a EXTRA_SKILLS=()
  local -a EXTRA_EXTENSIONS=()
  local BASE_MINDSET=""
  local MOD_CAVEMAN=false
  local MOD_RTK=false

  nothing_warn() { printf '⚠️  %s\n' "$*" >&2; }

  get_mindset_config() {
    local target_mindset="$1"
    local field="$2" # "skills" or "extensions"
    if [[ ! -f "$MINDSETS_JSON" ]]; then
      return
    fi
    node -e "
      const fs = require('fs');
      try {
        const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
        const mindset = data.mindsets[process.argv[2]];
        const field = process.argv[3];
        if (mindset && Array.isArray(mindset[field])) {
          for (const item of mindset[field]) console.log(item);
        }
      } catch (e) {}
    " "$MINDSETS_JSON" "$target_mindset" "$field"
  }

  resolve_skill_path() {
    local spec="$1"
    local candidate

    if [[ "$spec" == /* ]]; then
      [[ -e "$spec" ]] && printf '%s\n' "$spec"
      return
    fi

    for candidate in \
      "$NOTHING_DIR/packages/$spec" \
      "$NOTHING_DIR/$spec" \
      "$HOME/.pi/agent/skills/$spec"; do
      if [[ -e "$candidate" ]]; then
        printf '%s\n' "$candidate"
        return
      fi
    done
  }

  resolve_extension_path() {
    local spec="$1"
    local candidate

    if [[ "$spec" == /* ]]; then
      [[ -e "$spec" ]] && printf '%s\n' "$spec"
      return
    fi

    for candidate in \
      "$NOTHING_DIR/packages/$spec" \
      "$NOTHING_DIR/$spec" \
      "$HOME/.pi/agent/extensions/$spec"; do
      if [[ -e "$candidate" ]]; then
        printf '%s\n' "$candidate"
        return
      fi
    done
  }

  add_skill() {
    local spec="$1"
    local resolved
    resolved="$(resolve_skill_path "$spec")"
    if [[ -n "$resolved" ]]; then
      EXTRA_SKILLS+=("--skill" "$resolved")
    else
      nothing_warn "Skipping missing skill: $spec"
    fi
  }

  add_extension() {
    local spec="$1"
    local resolved
    resolved="$(resolve_extension_path "$spec")"
    if [[ -n "$resolved" ]]; then
      EXTRA_EXTENSIONS+=("--extension" "$resolved")
    else
      nothing_warn "Skipping missing extension: $spec"
    fi
  }

  ensure_caveman_cache() {
    local repo_dir="$NOTHING_CACHE_DIR/repos/caveman"
    if [[ -d "$repo_dir/skills/caveman" && -d "$repo_dir/skills/caveman-stats" ]]; then
      printf '%s\n' "$repo_dir"
      return 0
    fi
    if ! command -v git >/dev/null 2>&1; then
      nothing_warn "--caveman requested but git is unavailable; cannot install caveman cache"
      return 1
    fi
    nothing_warn "--caveman requested; installing caveman skills into $repo_dir"
    rm -rf "$repo_dir"
    mkdir -p "$(dirname "$repo_dir")"
    if git clone --depth 1 https://github.com/JuliusBrussee/caveman.git "$repo_dir" >/dev/null 2>&1; then
      printf '%s\n' "$repo_dir"
      return 0
    fi
    nothing_warn "Failed to install caveman skills into $repo_dir"
    rm -rf "$repo_dir"
    return 1
  }

  add_caveman_skills() {
    local repo_dir
    repo_dir="$(ensure_caveman_cache)" || return 0
    for skill_name in caveman caveman-stats; do
      if [[ -d "$repo_dir/skills/$skill_name" ]]; then
        EXTRA_SKILLS+=("--skill" "$repo_dir/skills/$skill_name")
      else
        nothing_warn "Cached caveman skill missing: $skill_name"
      fi
    done
    export PI_CAVEMAN="1"
  }

  ensure_rtk_cache() {
    local pkg_root="$NOTHING_CACHE_DIR/npm/rtk"
    local pkg_dir="$pkg_root/node_modules/pi-rtk-optimizer"
    if [[ -d "$pkg_dir" ]]; then
      printf '%s\n' "$pkg_dir"
      return 0
    fi
    if ! command -v npm >/dev/null 2>&1; then
      nothing_warn "--rtk requested but npm is unavailable; cannot install RTK optimizer cache"
      return 1
    fi
    nothing_warn "--rtk requested; installing pi-rtk-optimizer into $pkg_root"
    mkdir -p "$pkg_root"
    if npm install --prefix "$pkg_root" --omit=peer --no-audit --no-fund pi-rtk-optimizer >/dev/null 2>&1; then
      if [[ -d "$pkg_dir" ]]; then
        printf '%s\n' "$pkg_dir"
        return 0
      fi
    fi
    nothing_warn "Failed to install pi-rtk-optimizer into $pkg_root"
    return 1
  }

  add_rtk_extension() {
    local pkg_dir
    pkg_dir="$(ensure_rtk_cache)" || return 0
    EXTRA_EXTENSIONS+=("--extension" "$pkg_dir")
    export NOTHING_RTK="1"
  }

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --nothing|--android|--pm|--dev|--rpiv|--meta|--write|--antigravity)
        local flag_name="${1#--}"
        if [[ -n "$BASE_MINDSET" && "$BASE_MINDSET" != "$flag_name" ]]; then
          nothing_warn "Only one base hat allowed: --$BASE_MINDSET already set, got --$flag_name"
          return 2
        fi
        BASE_MINDSET="$flag_name"
        shift
        ;;
      --caveman)
        MOD_CAVEMAN=true
        shift
        ;;
      --rtk|--rkt)
        MOD_RTK=true
        shift
        ;;
      *)
        ARGS+=("$1")
        shift
        ;;
    esac
  done

  if [[ -n "$BASE_MINDSET" ]]; then
    export PI_MINDSET="$BASE_MINDSET"

    if [[ "$BASE_MINDSET" != "nothing" ]]; then
      local skills sk
      skills="$(get_mindset_config "$BASE_MINDSET" "skills")"
      while IFS= read -r sk; do
        [[ -n "$sk" ]] && add_skill "$sk"
      done <<< "$skills"

      local extensions ext
      extensions="$(get_mindset_config "$BASE_MINDSET" "extensions")"
      while IFS= read -r ext; do
        [[ -n "$ext" ]] && add_extension "$ext"
      done <<< "$extensions"
    fi
  fi

  if [[ "$BASE_MINDSET" == "nothing" ]]; then
    if [[ "$MOD_CAVEMAN" == true || "$MOD_RTK" == true ]]; then
      nothing_warn "--nothing requested; ignoring additive modifiers"
    fi
  else
    if [[ "$MOD_CAVEMAN" == true ]]; then
      add_caveman_skills
    fi

    if [[ "$MOD_RTK" == true ]]; then
      add_rtk_extension
    fi
  fi

  if [[ -n "$BASE_MINDSET" || "$MOD_CAVEMAN" == true || "$MOD_RTK" == true ]]; then
    local label="${BASE_MINDSET:-vanilla}"
    local -a mods=()
    [[ "$MOD_CAVEMAN" == true && "$BASE_MINDSET" != "nothing" ]] && mods+=("caveman")
    [[ "$MOD_RTK" == true && "$BASE_MINDSET" != "nothing" ]] && mods+=("rtk")
    local mod_label="none"
    if [[ ${#mods[@]} -gt 0 ]]; then
      mod_label="${mods[*]}"
    fi
    local skill_count=$(( ${#EXTRA_SKILLS[@]} / 2 ))
    local extension_count=$(( ${#EXTRA_EXTENSIONS[@]} / 2 ))
    printf '🧠 \033[0;35m[nothing]\033[0m Mindset: \033[1m%s\033[0m modifiers: \033[1m%s\033[0m (loaded: %s skills, %s extensions)\n' "$label" "$mod_label" "$skill_count" "$extension_count"
  fi

  local -a NOTHING_FLAGS=()
  if [[ "$BASE_MINDSET" == "nothing" ]]; then
    NOTHING_FLAGS+=("--no-skills" "--no-extensions" "--no-context-files")
  fi

  command pi "${NOTHING_FLAGS[@]}" "${EXTRA_SKILLS[@]}" "${EXTRA_EXTENSIONS[@]}" "${ARGS[@]}"
}
