```text
⠀⠀⠀⠀⣠⣤⣶⣶⣶⣤⣄⡀⠀
⠀⠀⣴⣾⣿⣿⣿⣿⣿⣧⡀⠈⠢
⠀⣼⣿⣿⣿⣿⣿⣿⣿⡿⠁⠀⠀
⢰⡿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀
⠘⣽⡿⠿⠿⣿⣿⣿⣿⣿⣦⣤⡀
⠀⣟⠀⠀⠀⣸⣿⡏⠀⠀⠀⢹⠗  nothingness
⠀⣿⣷⣶⣾⡿⠁⠙⣄⣀⣀⣠⡀
⠀⠙⠙⢿⡿⣷⣶⣤⣿⣿⡿⠿⠃
⠀⠀⠀⠺⡏⡏⡏⡏⡏⠉⠁⠀⠀
⠀⠀⠀⠀⠀⠀⠁⠁⠀⠀⠀⠀⠀
```

# nothing 🧠

> **The ultimate local-first agentic development environment.** `nothing` transforms the [Pi Coding Agent](https://pi.dev) into a professional, reproducible workflow engine with built-in privacy guards, specialized personas, and advanced context optimization.

`nothing` wires together Pi "hats", local workflow skills, privacy extensions, and local context compression into a single, cohesive setup that works identically on Linux and macOS.

---

## ✨ Features

- **🛡️ Privacy First**: Always-on credential and secret guard via `@raquezha/noleaks`.
- **🎩 Persona "Hats"**: Instant switching between Triage, PM, Dev, and Meta engineering modes.
- **🗜️ Context Optimization**: Integrated local [Headroom](https://github.com/headroom-ai/headroom) compression via `@raquezha/noheadroom`.
- **🔄 RPIV Workflow**: A formal Frame → Plan → Implement → Verify → Sync cycle for reliable agentic output.
- **🚀 One-Command Bootstrap**: reproducible environment setup across home and work machines.

## 📦 What's Inside

| Category | Component | Purpose |
|---|---|---|
| **Privacy** | [`@raquezha/noleaks`](./packages/noleaks) | credential & secret protection |
| **Optimization** | [`headroom/`](./headroom), [`@raquezha/noheadroom`](./packages/noheadroom) | local context compression |
| **Workflow** | [`@raquezha/norpiv`](./packages/norpiv) | the core RPIV agentic process |
| **Search** | [`@raquezha/nosearch`](./packages/nosearch) | Brave & Firecrawl subagent |
| **UI/UX** | [`@raquezha/notrace`](./packages/notrace), [`nofooter`](./packages/nofooter) | HTML trace viewer & powerline footer |
| **Providers** | [`@raquezha/antigravity`](./packages/antigravity) | Google Antigravity model support |

## 🚀 Getting Started

### 1. Install Full Setup

Fresh machine / personal setup:

```bash
git clone https://github.com/raquezha/nothing.git
cd nothing
./bootstrap.sh --headroom
```

> ⚠️ **Warning**: `./bootstrap.sh` archives/resets global Pi discovery directories to ensure a clean, reproducible starting state. Use `--no-reset-pi` if you want to keep existing global resources.

### 2. Reload Shell

```bash
source ./dotfiles/shell_integration.sh
```

## 🎩 Persona Hats & Modifiers

Base hats load repo-local skills and personas:

```bash
pi --rpiv        # standard RPIV workflow (Frame -> Implement -> Verify)
pi --pm          # research, planning, and sync persona
pi --dev         # implementation and verification focus
pi --android     # Android development expert; loads local Android CLI skill cache only
pi --meta        # skill engineering and nothing maintenance
pi --nothing     # ultimate "clean" mode: zero built-in tools/context
```

Additive modifiers for power users:

```bash
pi --headroom    # enable local context compression
pi --caveman     # terse, token-efficient communication
pi --rtk          # local terminal output optimization
pi --tkmx         # THE COMBO: --antigravity + --headroom + --caveman + --rtk
```

## 🧩 Standalone Usage

Don't want the full setup? You can still use the skills and packages independently.

### Install published skills
```bash
npx -y skills add raquezha/nothing --full-depth -g -a pi -s '*' -y
```

### Install Pi packages
```bash
pi install npm:@raquezha/noheadroom
pi install npm:@raquezha/norpiv
```

---

## 🛠 Maintenance

- **Build packages**: `npm run build --workspaces`
- **Verify repo**: `npm test`
- **Refresh Android CLI skills**: `pi --android-update` or `./scripts/android-skills-refresh.sh`

### Android CLI skills cache

`pi --android` never installs, updates, or checks the network. It only loads the local cache at `$NOTHING_CACHE_DIR/android-skills` (default: `~/.local/share/nothing/android-skills`). If the cache is missing or locally stamped stale, it warns and continues safely.

Run `pi --android-update` when you explicitly want network work. The refresh script runs `android update`, installs skills with `android skills add --all --project=<temp project>`, verifies `skills/android-cli/SKILL.md`, and atomically swaps the cache.

If the Android CLI is missing, the script prints the Linux/macOS install command. It only runs the installer when you pass `--install-cli`.

## 🤝 Attribution

- Powered by [Pi Coding Agent](https://pi.dev).
- Context compression by [Headroom](https://github.com/headroom-ai/headroom).
- Terse mode inspired by [Caveman](https://github.com/JuliusBrussee/caveman).

---

**[nothing](https://github.com/raquezha/nothing)** — Built for local-first agentic autonomy.
