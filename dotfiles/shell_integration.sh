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
        done

        # Load extensions from mindsets.json
        local extensions
        extensions=$(get_mindset_config "$flag_name" "extensions")
        for ext in $extensions; do
          EXTRA_EXTENSIONS+=("--extension" "$NOTHING_DIR/packages/$ext")
        done
        
        shift
        ;;
      *)
        ARGS+=("$1")
        shift
        ;;
    esac
  done

  # Call the global pi command with the computed skills/extensions
  if [[ -n "$MINDSET" ]]; then
    echo -e "🧠 \033[0;35m[nothing]\033[0m Mindset: \033[1m$MINDSET\033[0m (loaded: ${#EXTRA_SKILLS[@]} skills, ${#EXTRA_EXTENSIONS[@]} extensions)"
  fi
  
  command pi "${EXTRA_SKILLS[@]}" "${EXTRA_EXTENSIONS[@]}" "${ARGS[@]}"
}
