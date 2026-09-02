#!/bin/bash
# Deterministically grabs the active Pi model from the current session logs

# Format PWD to match Pi's session directory naming convention
SAFE_PWD=$(pwd | sed 's/\//-/g' | sed 's/^-/--/')
TARGET_DIR="$HOME/.pi/agent/sessions/${SAFE_PWD}--"

if [ -d "$TARGET_DIR" ]; then
    LATEST_FILE=$(find "$TARGET_DIR" -maxdepth 1 -type f -exec stat -f "%m %N" {} + 2>/dev/null | sort -rn | head -n 1 | cut -d' ' -f2-)
    if [ -n "$LATEST_FILE" ] && [ -f "$LATEST_FILE" ]; then
        MODEL_INFO=$(jq -r 'select(.provider != null or .message.provider != null) | "\(.provider // .message.provider):\(.modelId // .model // .message.model)"' "$LATEST_FILE" 2>/dev/null | tail -n 1)
        if [ -n "$MODEL_INFO" ] && [ "$MODEL_INFO" != "null:null" ]; then
            echo "$MODEL_INFO"
            exit 0
        fi
    fi
fi

# Fallback if no active session log can be parsed
echo "UnknownAgent:UnknownModel"
