#!/bin/bash

# init.sh: Initializes a repository with Agent-First infrastructure.

SKILL_DIR=$(dirname "$(dirname "$0")")
TEMPLATES_DIR="$SKILL_DIR/templates"
DISCOVER_SH="$SKILL_DIR/scripts/discover.sh"

echo "🚀 Initializing Agent OS..."

# 1. Discovery
DISCOVERY=$($DISCOVER_SH)
STACK=$(echo "$DISCOVERY" | grep "Stack:" | cut -d' ' -f2)
LANG=$(echo "$DISCOVERY" | grep "Language:" | cut -d' ' -f2)
TESTER=$(echo "$DISCOVERY" | grep "Tester:" | cut -d' ' -f2)
[ -z "$TESTER" ] && TESTER="Not detected"

# 2. Setup AGENTS.md
if [ -f "AGENTS.md" ]; then
    echo "⚠️  AGENTS.md already exists. Backing up to AGENTS.md.bak"
    mv AGENTS.md AGENTS.md.bak
fi
cp "$TEMPLATES_DIR/AGENTS.md.template" "AGENTS.md"
echo "✅ Created AGENTS.md with Bootstrap header."

# 3. Setup CONTEXT.md
if [ ! -f "CONTEXT.md" ]; then
    PROJECT_NAME=$(basename "$(pwd)")
    DATE=$(date +%Y-%m-%d)
    
    sed -e "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" \
        -e "s/{{LANGUAGE}}/$LANG/g" \
        -e "s/{{FRAMEWORK}}/$STACK/g" \
        -e "s/{{TESTER}}/$TESTER/g" \
        -e "s/{{DATE}}/$DATE/g" \
        "$TEMPLATES_DIR/CONTEXT.md.template" > "CONTEXT.md"
    echo "✅ Created CONTEXT.md with detected stack: $STACK/$LANG."
else
    echo "ℹ️  CONTEXT.md already exists. Skipping creation."
fi

# 4. Setup .workflow/
mkdir -p .workflow/tasks
if [ ! -f ".gitignore" ] || ! grep -q ".workflow/" .gitignore; then
    echo ".workflow/" >> .gitignore
    echo "✅ Added .workflow/ to .gitignore."
fi

echo "🎉 Repo initialized! Any agent landing here will now 'Load Firmware' automatically."
