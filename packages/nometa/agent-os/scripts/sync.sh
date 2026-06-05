#!/bin/bash

# sync.sh: Synchronizes Agent-First infrastructure with the current state of the repo.

SKILL_DIR=$(dirname "$(dirname "$0")")
DISCOVER_SH="$SKILL_DIR/scripts/discover.sh"

echo "🔄 Syncing Agent OS Context..."

if [ ! -f "CONTEXT.md" ]; then
    echo "❌ CONTEXT.md not found. Run init.sh first."
    exit 1
fi

# 1. Re-run Discovery
DISCOVERY=$($DISCOVER_SH)
NEW_STACK=$(echo "$DISCOVERY" | grep "Stack:" | cut -d' ' -f2)
NEW_LANG=$(echo "$DISCOVERY" | grep "Language:" | cut -d' ' -f2)
NEW_TESTER=$(echo "$DISCOVERY" | grep "Tester:" | cut -d' ' -f2)

# 2. Check for Drift in CONTEXT.md
DRIFT_FOUND=0

check_drift() {
    local label=$1
    local current_val=$2
    local new_val=$3
    
    if ! grep -q "$new_val" CONTEXT.md; then
        echo "⚠️  DRIFT DETECTED: $label has changed from what is in CONTEXT.md to '$new_val'."
        DRIFT_FOUND=1
    fi
}

check_drift "Stack/Framework" "$STACK" "$NEW_STACK"
check_drift "Language" "$LANG" "$NEW_LANG"
if [ -n "$NEW_TESTER" ]; then
    check_drift "Testing Framework" "$TESTER" "$NEW_TESTER"
fi

# 3. Check for structural changes (Map of the Land)
# We can do a quick check of top-level directories vs what's in CONTEXT.md
echo "🔍 Checking 'Map of the Land'..."
DIRS=$(ls -d */ 2>/dev/null)
for dir in $DIRS; do
    dir_name=$(echo "$dir" | tr -d '/')
    if ! grep -q "/$dir_name" CONTEXT.md; then
        echo "⚠️  NEW DIRECTORY: '/$dir_name' is not documented in 'Map of the Land'."
        DRIFT_FOUND=1
    fi
done

# 4. Propose Fixes
if [ $DRIFT_FOUND -eq 1 ]; then
    echo ""
    echo "💡 Recommendations (Apply these using /update-docs or manual edit):"
    echo "1. Update CONTEXT.md to reflect the new stack or directory structure."
    echo "2. Check if old architectural decisions in 'Domain Logic' still hold true."
else
    echo "✅ Context is in sync with reality."
fi

# 5. Anti-Bloat Check
# If CONTEXT.md is getting too long, warn the user.
LINE_COUNT=$(wc -l < CONTEXT.md)
if [ "$LINE_COUNT" -gt 100 ]; then
    echo "⚠️  ANTI-BLOAT WARNING: CONTEXT.md is over 100 lines. Consider trimming or moving detail to docs/agents/."
fi

echo "--- SYNC COMPLETE ---"
