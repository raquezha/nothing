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
  # Pi subcommands must remain the first argv token. If we inject extensions or
  # skills before them, the CLI treats the subcommand as an initial chat prompt
  # instead (for example: `pi update` opens Pi with "update" as input).
  case "${1:-}" in
    install|remove|uninstall|list|config)
      command pi "$@"
      return $?
      ;;
  esac

  local NOTHING_DIR="$_NOTHING_REPO_DIR"
  local MINDSETS_JSON="$NOTHING_DIR/config/mindsets.json"
  local NOTHING_CACHE_DIR="${NOTHING_CACHE_DIR:-$HOME/.local/share/nothing}"

  export PI_MINDSET=""

  local -a ARGS=()
  local -a EXTRA_SKILLS=()
  local -a EXTRA_EXTENSIONS=()
  local BASE_MINDSET=""
  local COMBO_PRESET=""
  local MOD_CAVEMAN=false
  local MOD_RTK=false
  local MOD_HEADROOM=false
  local MOD_ANTIGRAVITY=false
  local MOD_NOTRACE=false
  local MOD_PONYTAIL=false

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
      # If the resolved path is a directory without a SKILL.md, but has subdirectories
      # that DO have SKILL.md, we expand it to those subdirectories to avoid
      # Pi scanning the parent directory and hitting non-skill markdown files.
      if [[ -d "$resolved" && ! -f "$resolved/SKILL.md" ]]; then
        local found_sub=false
        local sub_skill_dir
        # We look for SKILL.md exactly one level down (depth 2 relative to find root)
        while IFS= read -r sub_skill_dir; do
          if [[ -n "$sub_skill_dir" ]]; then
            EXTRA_SKILLS+=("--skill" "$sub_skill_dir")
            found_sub=true
          fi
        done <<EOF
$(find "$resolved" -mindepth 2 -maxdepth 2 -name "SKILL.md" -exec dirname {} \;)
EOF
        if [[ "$found_sub" == true ]]; then
          return
        fi
      fi
      EXTRA_SKILLS+=("--skill" "$resolved")
    else
      nothing_warn "Skipping missing skill: $spec"
    fi
  }

  extension_is_loaded() {
    local resolved="$1"
    local i=0
    while [[ $i -lt ${#EXTRA_EXTENSIONS[@]} ]]; do
      if [[ "${EXTRA_EXTENSIONS[$i]}" == "--extension" && "${EXTRA_EXTENSIONS[$((i + 1))]}" == "$resolved" ]]; then
        return 0
      fi
      i=$((i + 2))
    done
    return 1
  }

  add_extension() {
    local spec="$1"
    local resolved
    resolved="$(resolve_extension_path "$spec")"
    if [[ -n "$resolved" ]]; then
      if extension_is_loaded "$resolved"; then
        return
      fi
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
    local intensity="${1:-full}"
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
    export PI_CAVEMAN_INTENSITY="$intensity"
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

  ensure_ponytail_cache() {
    local repo_dir="$NOTHING_CACHE_DIR/repos/ponytail"
    if [[ -f "$repo_dir/package.json" && -d "$repo_dir/skills" && -f "$repo_dir/pi-extension/index.js" ]]; then
      printf '%s\n' "$repo_dir"
      return 0
    fi
    if ! command -v git >/dev/null 2>&1; then
      nothing_warn "--ponytail requested but git is unavailable; cannot install ponytail cache"
      return 1
    fi
    nothing_warn "--ponytail requested; installing ponytail into $repo_dir"
    rm -rf "$repo_dir"
    mkdir -p "$(dirname "$repo_dir")"
    if git clone --depth 1 https://github.com/DietrichGebert/ponytail.git "$repo_dir" >/dev/null 2>&1; then
      printf '%s\n' "$repo_dir"
      return 0
    fi
    nothing_warn "Failed to install ponytail into $repo_dir"
    rm -rf "$repo_dir"
    return 1
  }

  add_ponytail() {
    local repo_dir
    repo_dir="$(ensure_ponytail_cache)" || return 0
    EXTRA_EXTENSIONS+=("--extension" "$repo_dir")
    add_skill "$repo_dir/skills"
    export PONYTAIL_DEFAULT_MODE="${PONYTAIL_DEFAULT_MODE:-full}"
    export NOTHING_PONYTAIL="1"
  }

  ensure_headroom_proxy() {
    local up_script="$NOTHING_DIR/scripts/headroom-up.sh"
    if [[ ! -f "$up_script" ]]; then
      nothing_warn "--headroom requested but missing script: $up_script"
      return 1
    fi
    if [[ "${NOTHING_HEADROOM_SKIP_START:-}" == "1" ]]; then
      nothing_warn "--headroom requested; skipping backend start because NOTHING_HEADROOM_SKIP_START=1"
    else
      if ! command -v docker >/dev/null 2>&1; then
        nothing_warn "--headroom requested but docker is unavailable"
        return 1
      fi
      HEADROOM_HEALTH_SUMMARY=1 bash "$up_script" >&2 || {
        nothing_warn "Headroom backend failed to start"
        return 1
      }
    fi
    export NOTHING_HEADROOM="1"
    export PI_HEADROOM_URL="http://127.0.0.1:8788"
  }

  add_android_skills() {
    local cache_dir="${ANDROID_SKILLS_CACHE_DIR:-$NOTHING_CACHE_DIR/android-skills}"
    local skills_dir="$cache_dir/skills"
    local stamp="$cache_dir/.refreshed-at"
    local stale_days="${ANDROID_SKILLS_STALE_DAYS:-14}"
    local found_skill=false
    local skill_file
    local stale_hit

    if [[ ! -d "$skills_dir" ]]; then
      nothing_warn "Android skills cache missing; run: pi update"
      return 0
    fi

    if [[ -f "$stamp" ]]; then
      stale_hit="$(find "$stamp" -mtime +"$stale_days" -print -quit 2>/dev/null)"
      if [[ -n "$stale_hit" ]]; then
        nothing_warn "Android skills cache may be stale; run: pi update"
      fi
    fi

    while IFS= read -r skill_file; do
      if [[ -n "$skill_file" ]]; then
        EXTRA_SKILLS+=("--skill" "$(dirname "$skill_file")")
        found_skill=true
      fi
    done <<EOF
$(find "$skills_dir" -mindepth 2 -maxdepth 2 -name "SKILL.md" 2>/dev/null)
EOF

    if [[ "$found_skill" != true ]]; then
      nothing_warn "Android skills cache has no skills; run: pi update"
    fi
    export NOTHING_ANDROID_SKILLS_CACHE="$cache_dir"
  }

  update_git_cache() {
    local name="$1" url="$2" dir="$3"
    if ! command -v git >/dev/null 2>&1; then
      nothing_warn "Skipping $name update; git unavailable"
      return 0
    fi
    mkdir -p "$(dirname "$dir")"
    if [[ -d "$dir/.git" ]]; then
      if git -C "$dir" pull --ff-only >/dev/null 2>&1; then
        printf '✅ [nothing] updated %s\n' "$name" >&2
        return 0
      fi
      nothing_warn "$name update failed; recloning"
      rm -rf "$dir"
    fi
    if git clone --depth 1 "$url" "$dir" >/dev/null 2>&1; then
      printf '✅ [nothing] installed %s\n' "$name" >&2
    else
      nothing_warn "Failed to update $name"
    fi
  }

  update_rtk_cache() {
    local pkg_root="$NOTHING_CACHE_DIR/npm/rtk"
    if ! command -v npm >/dev/null 2>&1; then
      nothing_warn "Skipping RTK update; npm unavailable"
      return 0
    fi
    mkdir -p "$pkg_root"
    if npm install --prefix "$pkg_root" --omit=peer --no-audit --no-fund pi-rtk-optimizer@latest >/dev/null 2>&1; then
      printf '✅ [nothing] updated rtk\n' >&2
    else
      nothing_warn "Failed to update RTK"
    fi
  }

  update_android_cache() {
    local refresh_script="$NOTHING_DIR/scripts/android-skills-refresh.sh"
    if [[ -f "$refresh_script" ]]; then
      bash "$refresh_script" || nothing_warn "Failed to update Android skills"
    else
      nothing_warn "Skipping Android skills update; missing $refresh_script"
    fi
  }

  update_headroom_cache() {
    local compose_file="$NOTHING_DIR/headroom/compose.yml"
    if [[ ! -f "$compose_file" ]]; then
      return 0
    fi
    if ! command -v docker >/dev/null 2>&1; then
      nothing_warn "Skipping Headroom update; docker unavailable"
      return 0
    fi
    if docker compose -f "$compose_file" pull >/dev/null 2>&1; then
      printf '✅ [nothing] updated headroom\n' >&2
    else
      nothing_warn "Failed to update Headroom image"
    fi
  }

  nothing_update_caches() {
    printf '🔄 [nothing] updating managed caches\n' >&2
    update_git_cache "caveman" "https://github.com/JuliusBrussee/caveman.git" "$NOTHING_CACHE_DIR/repos/caveman"
    update_git_cache "ponytail" "https://github.com/DietrichGebert/ponytail.git" "$NOTHING_CACHE_DIR/repos/ponytail"
    update_rtk_cache
    update_android_cache
    update_headroom_cache
  }

  if [[ $# -gt 0 ]]; then
    case "$1" in
      update)
        command pi "$@"
        local pi_update_status=$?
        nothing_update_caches
        return "$pi_update_status"
        ;;
      install|remove|uninstall|list|config)
        command pi "$@"
        return
        ;;
    esac
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --nothing|--android|--pm|--dev|--rpiv|--meta|--write|--notes)
        local flag_name="${1#--}"
        if [[ -n "$BASE_MINDSET" && "$BASE_MINDSET" != "$flag_name" ]]; then
          nothing_warn "Only one base hat allowed: --$BASE_MINDSET already set, got --$flag_name"
          return 2
        fi
        BASE_MINDSET="$flag_name"
        shift
        ;;
      --antigravity)
        MOD_ANTIGRAVITY=true
        shift
        ;;
      --notrace)
        MOD_NOTRACE=true
        shift
        ;;
      --ponytail)
        MOD_PONYTAIL=true
        shift
        ;;
      --tkmx)
        COMBO_PRESET="tkmx"
        MOD_ANTIGRAVITY=true
        MOD_NOTRACE=true
        MOD_PONYTAIL=true
        MOD_CAVEMAN=true
        MOD_CAVEMAN_INTENSITY="ultra"
        MOD_RTK=true
        MOD_HEADROOM=true
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
      --headroom)
        MOD_HEADROOM=true
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

      if [[ "$BASE_MINDSET" == "android" ]]; then
        add_android_skills
      fi
    fi
  fi

  if [[ "$BASE_MINDSET" == "nothing" ]]; then
    if [[ "$MOD_CAVEMAN" == true || "$MOD_RTK" == true || "$MOD_HEADROOM" == true || "$MOD_ANTIGRAVITY" == true || "$MOD_NOTRACE" == true || "$MOD_PONYTAIL" == true ]]; then
      nothing_warn "--nothing requested; ignoring additive modifiers"
    fi
  else
    if [[ "$MOD_CAVEMAN" == true ]]; then
      add_caveman_skills "${MOD_CAVEMAN_INTENSITY:-full}"
    fi

    if [[ "$MOD_RTK" == true ]]; then
      add_rtk_extension
    fi

    if [[ "$MOD_HEADROOM" == true ]]; then
      ensure_headroom_proxy
      add_extension "noheadroom"
    fi

    if [[ "$MOD_ANTIGRAVITY" == true ]]; then
      add_extension "antigravity"
    fi

    if [[ "$MOD_NOTRACE" == true ]]; then
      add_extension "notrace"
    fi

    if [[ "$MOD_PONYTAIL" == true ]]; then
      add_ponytail
    fi
  fi

  add_extension "noleaks"

  if [[ -n "$BASE_MINDSET" || "$MOD_CAVEMAN" == true || "$MOD_RTK" == true || "$MOD_HEADROOM" == true || "$MOD_ANTIGRAVITY" == true || "$MOD_NOTRACE" == true || "$MOD_PONYTAIL" == true || ${#EXTRA_SKILLS[@]} -gt 0 || ${#EXTRA_EXTENSIONS[@]} -gt 0 ]]; then
    local label="${COMBO_PRESET:-${BASE_MINDSET:-vanilla}}"
    local -a mods=()
    [[ "$MOD_CAVEMAN" == true && "$BASE_MINDSET" != "nothing" ]] && mods+=("caveman")
    [[ "$MOD_RTK" == true && "$BASE_MINDSET" != "nothing" ]] && mods+=("rtk")
    [[ "$MOD_HEADROOM" == true && "$BASE_MINDSET" != "nothing" ]] && mods+=("headroom")
    [[ "$MOD_ANTIGRAVITY" == true && "$BASE_MINDSET" != "nothing" ]] && mods+=("antigravity")
    [[ "$MOD_NOTRACE" == true && "$BASE_MINDSET" != "nothing" ]] && mods+=("notrace")
    [[ "$MOD_PONYTAIL" == true && "$BASE_MINDSET" != "nothing" ]] && mods+=("ponytail")
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
    NOTHING_FLAGS+=("--system-prompt" "" "--no-builtin-tools" "--no-skills" "--no-extensions" "--no-prompt-templates" "--no-themes" "--no-context-files")
  fi

  command pi "${NOTHING_FLAGS[@]}" "${EXTRA_SKILLS[@]}" "${EXTRA_EXTENSIONS[@]}" "${ARGS[@]}"
}
