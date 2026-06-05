---
name: nothing-bootstrap
description: "Bootstrap, migrate, or restore the 'nothing' agentic environment (NPM extensions, declarative mindsets, settings, and shell integration) on a Linux or macOS setup."
---

# Skill: nothing-bootstrap

A meta-skill designed to orchestrate the installation, deployment, and health verification of the `nothing` monorepo configuration.

## Guardrails
- **READ**: Shell profile (`~/.zshrc`, `~/.bashrc`), global settings (`~/.pi/agent/settings.json`), and git branch info.
- **WRITE**: Writes only to `~/.pi/agent/settings.json` (merging settings), `~/.pi/agent/mindsets.json`, and appends the shell loader wrapper to the shell rc file.
- **NEVER**: Modify system-wide packages or run `brew install` / `apt-get` commands without explicit user permission.

## Workflow

1. **Pre-flight Audit**:
   - Check if Node.js (>=18.0.0), NPM, git, tmux, and gh are installed.
   - Detect shell configuration and locate the appropriate rc file (`~/.zshrc` or `~/.bashrc`).

2. **Workspaces Sync**:
   - Copy or symlink `settings.json` and `mindsets.json` to the global configuration path `~/.pi/agent/`.
   - Verify that the credential shield `"noleaks": true` is active globally.

3. **Global Packages Setup**:
   - Run the bootstrap script to install the `@mariozechner/pi-coding-agent` alongside packaged extensions (`notrace`, `noleaks`) globally via NPM.

4. **Shell Integration**:
   - Inspect the shell rc file. If missing, append the sourcing command pointing to the dynamic loader wrapper:
     ```bash
     source /path/to/nothing/dotfiles/shell_integration.sh
     ```

5. **Diagnostic Verification**:
   - Verify aliases by running `/reload` and testing the mindset wrapper.
   - Run a quick health check confirming that all global symlinks are correct.

## Output Contract
Upon completion, print:
- **Environment Status**: macOS (Darwin) or Linux.
- **Installed Packages**: Pi agent and extensions versions.
- **Active Mindsets**: List of loaded mindsets (`rpiv`, `dev`, `pm`, `android`, etc.).
- **Diagnostic Result**: Pass / Fail.
