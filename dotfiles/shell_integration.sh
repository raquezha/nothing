#!/usr/bin/env bash
#
# nothing monorepo shell integration
#

pi() {
  local NOTHING_DIR
  NOTHING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  
  local MINDSETS_JSON="$NOTHING_DIR/mindsets.json"
  
  # Always clear the mindset at the start of the function
  export PI_MINDSET=""
  
  local ARGS=()
  local EXTRA_SKILLS=()
  local EXTRA_EXTENSIONS=()
  local MINDSET=""
  local AUTO_PROVIDER=""
  local AUTO_MODEL=""
  local AUTO_PRIORITY=0
  local EXPLICIT_MODEL=0

  # Node-based helper to extract mindset config
  get_mindset_config() {
    local target_mindset="$1"
    local field="$2" # "skills" or "extensions"
    if [[ ! -f "$MINDSETS_JSON" ]]; then
      return
    fi
    node -e "
      const fs = require('fs');
      try {
        const data = JSON.parse(fs.readFileSync('$MINDSETS_JSON', 'utf8'));
        const mindset = data.mindsets['$target_mindset'];
        if (mindset && mindset['$field']) {
          console.log(mindset['$field'].join(' '));
        }
      } catch (e) {}
    "
  }

  get_auto_model_config() {
    local skill_name="$1"
    if [[ ! -f "$MINDSETS_JSON" ]]; then
      return
    fi
    node -e "
      const fs = require('fs');
      try {
        const data = JSON.parse(fs.readFileSync('$MINDSETS_JSON', 'utf8'));
        const config = data.default_models['$skill_name'];
        if (config) {
          console.log(config.provider + ' ' + config.model + ' ' + config.priority);
        }
      } catch (e) {}
    "
  }

  set_auto_model() {
    local provider="$1"
    local model="$2"
    local priority="$3"

    if [[ "$EXPLICIT_MODEL" -eq 1 ]]; then
      return
    fi

    if (( priority > AUTO_PRIORITY )); then
      AUTO_PROVIDER="$provider"
      AUTO_MODEL="$model"
      AUTO_PRIORITY="$priority"
    fi
  }

  model_for_skill_path() {
    local target="$1"
    local skill_name
    skill_name="$(basename "$target")"
    
    local config
    config=$(get_auto_model_config "$skill_name")
    if [[ -n "$config" ]]; then
      set_auto_model $config
    fi
  }

  # Parse custom flags
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --android|--pm|--dev|--rpiv|--meta|--write|--antigravity)
        local flag_name="${1#--}"
        export PI_MINDSET="$flag_name"
        MINDSET="$flag_name"
        
        # Load skills from mindsets.json
        local skills
        skills=$(get_mindset_config "$flag_name" "skills")
        for sk in $skills; do
          EXTRA_SKILLS+=("--skill" "$NOTHING_DIR/packages/$sk")
          model_for_skill_path "$NOTHING_DIR/packages/$sk"
        done

        # Load extensions from mindsets.json
        local extensions
        extensions=$(get_mindset_config "$flag_name" "extensions")
        for ext in $extensions; do
          EXTRA_EXTENSIONS+=("--extension" "$NOTHING_DIR/packages/$ext")
        done
        
        shift
        ;;
      --skill)
        ARGS+=("$1")
        if [[ $# -gt 1 ]]; then
          model_for_skill_path "$2"
          ARGS+=("$2")
          shift 2
        else
          shift
        fi
        ;;
      --skill=*)
        ARGS+=("$1")
        model_for_skill_path "${1#--skill=}"
        shift
        ;;
      --model)
        EXPLICIT_MODEL=1
        ARGS+=("$1")
        if [[ $# -gt 1 ]]; then
          ARGS+=("$2")
          shift 2
        else
          shift
        fi
        ;;
      --model=*)
        EXPLICIT_MODEL=1
        ARGS+=("$1")
        shift
        ;;
      --provider)
        EXPLICIT_MODEL=1
        ARGS+=("$1")
        if [[ $# -gt 1 ]]; then
          ARGS+=("$2")
          shift 2
        else
          shift
        fi
        ;;
      --provider=*)
        EXPLICIT_MODEL=1
        ARGS+=("$1")
        shift
        ;;
      *)
        ARGS+=("$1")
        shift
        ;;
    esac
  done

  # Inject default provider/model if matched
  if [[ -n "$AUTO_PROVIDER" && "$EXPLICIT_MODEL" -eq 0 ]]; then
    ARGS+=("--provider" "$AUTO_PROVIDER" "--model" "$AUTO_MODEL")
  fi

  # Call the global pi command with the computed skills/extensions
  if [[ -n "$MINDSET" ]]; then
    echo -e "🧠 \033[0;35m[nothing]\033[0m Mindset: \033[1m$MINDSET\033[0m (loaded: ${#EXTRA_SKILLS[@]} skills, ${#EXTRA_EXTENSIONS[@]} extensions)"
  fi
  
  command pi "${EXTRA_SKILLS[@]}" "${EXTRA_EXTENSIONS[@]}" "${ARGS[@]}"
}
