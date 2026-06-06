#!/usr/bin/env bash
#
# nothing monorepo shell integration
#

pi() {
  local NOTHING_DIR
  NOTHING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

  local MINDSETS_JSON="$NOTHING_DIR/mindsets.json"

  export PI_MINDSET=""

  local ARGS=()
  local EXTRA_SKILLS=()
  local EXTRA_EXTENSIONS=()
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
          console.log(mindset[field].join(' '));
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
      --rtk)
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
      local skills
      skills="$(get_mindset_config "$BASE_MINDSET" "skills")"
      for sk in $skills; do
        add_skill "$sk"
      done

      local extensions
      extensions="$(get_mindset_config "$BASE_MINDSET" "extensions")"
      for ext in $extensions; do
        add_extension "$ext"
      done
    fi
  fi

  if [[ "$BASE_MINDSET" == "nothing" ]]; then
    if [[ "$MOD_CAVEMAN" == true || "$MOD_RTK" == true ]]; then
      nothing_warn "--nothing requested; ignoring additive modifiers"
    fi
  else
    if [[ "$MOD_CAVEMAN" == true ]]; then
      add_skill "caveman"
      add_skill "caveman-stats"
      export PI_CAVEMAN="1"
    fi

    if [[ "$MOD_RTK" == true ]]; then
      export NOTHING_RTK="1"
      if command -v rtk >/dev/null 2>&1; then
        nothing_warn "--rtk requested; using existing RTK install if Pi hook is initialized"
      else
        nothing_warn "--rtk requested but rtk not found; install/init RTK before expecting compression"
      fi
    fi
  fi

  if [[ -n "$BASE_MINDSET" || "$MOD_CAVEMAN" == true || "$MOD_RTK" == true ]]; then
    local label="${BASE_MINDSET:-vanilla}"
    local mods=()
    [[ "$MOD_CAVEMAN" == true && "$BASE_MINDSET" != "nothing" ]] && mods+=("caveman")
    [[ "$MOD_RTK" == true && "$BASE_MINDSET" != "nothing" ]] && mods+=("rtk")
    local mod_label="none"
    if [[ ${#mods[@]} -gt 0 ]]; then
      mod_label="${mods[*]}"
    fi
    local skill_count=$(( ${#EXTRA_SKILLS[@]} / 2 ))
    local extension_count=$(( ${#EXTRA_EXTENSIONS[@]} / 2 ))
    echo -e "🧠 \033[0;35m[nothing]\033[0m Mindset: \033[1m$label\033[0m modifiers: \033[1m$mod_label\033[0m (loaded: $skill_count skills, $extension_count extensions)"
  fi

  command pi "${EXTRA_SKILLS[@]}" "${EXTRA_EXTENSIONS[@]}" "${ARGS[@]}"
}
