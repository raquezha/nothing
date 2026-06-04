#!/bin/bash

# discover.sh: Detects the tech stack of the current repository.

echo "--- REPO DISCOVERY ---"

# Detect Language/Runtime
if [ -f "package.json" ]; then
    echo "Stack: Node.js"
    if [ -f "tsconfig.json" ]; then
        echo "Language: TypeScript"
    else
        echo "Language: JavaScript"
    fi
elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
    echo "Stack: Python"
elif [ -f "go.mod" ]; then
    echo "Stack: Go"
elif [ -f "Cargo.toml" ]; then
    echo "Stack: Rust"
else
    echo "Stack: Unknown/General"
fi

# Detect Test Runner
if grep -q "jest" package.json 2>/dev/null; then
    echo "Tester: Jest"
elif grep -q "vitest" package.json 2>/dev/null; then
    echo "Tester: Vitest"
elif [ -f "pytest.ini" ] || [ -d "tests" ]; then
    echo "Tester: Pytest"
fi

# Detect CI/CD
if [ -d ".github/workflows" ]; then
    echo "CI: GitHub Actions"
elif [ -f ".gitlab-ci.yml" ]; then
    echo "CI: GitLab CI"
fi

echo "--- END DISCOVERY ---"
