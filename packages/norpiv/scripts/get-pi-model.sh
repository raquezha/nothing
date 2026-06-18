#!/bin/bash
# Deterministically grabs the active Pi model from the current session logs

# Format PWD to match Pi's session directory naming convention
SAFE_PWD=$(pwd | sed 's/\//-/g' | sed 's/^-/--/')
TARGET_DIR="$HOME/.pi/agent/sessions/${SAFE_PWD}--"

if [ -d "$TARGET_DIR" ]; then
    LATEST_FILE=$(ls -t "$TARGET_DIR" | head -n 1 2>/dev/null)
    if [ -n "$LATEST_FILE" ]; then
        PROVIDER=$(cat "$TARGET_DIR/$LATEST_FILE" | grep -o '"provider":"[^"]*"' | tail -n 1 | cut -d'"' -f4)
        MODEL=$(cat "$TARGET_DIR/$LATEST_FILE" | grep -o '"model":"[^"]*"' | tail -n 1 | cut -d'"' -f4)
        
        if [ -n "$MODEL" ]; then
            # If provider exists, prefix it, otherwise just return model
            if [ -n "$PROVIDER" ]; then
                echo "$PROVIDER:$MODEL"
            else
                echo "UnknownProvider:$MODEL"
            fi
            exit 0
        fi
    fi
fi

# Fallback if no active session log can be parsed
echo "UnknownAgent:UnknownModel"
