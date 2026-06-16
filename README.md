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
- **🔄 Workflow Platform**: A generic [Workflow Contract](./docs/workflow.md) with RPIV for execution and Research for discovery.
- **🚀 One-Command Bootstrap**: reproducible environment setup across home and work machines.

## 📦 What's Inside

| Category | Component | Purpose |
|---|---|---|
| **Privacy** | [`@raquezha/noleaks`](./packages/noleaks) | credential & secret protection |
| **Optimization** | [`headroom/`](./headroom), [`@raquezha/noheadroom`](./packages/noheadroom) | local context compression |
| **Workflow** | [`@raquezha/norpiv`](./packages/workflows/norpiv), [`noresearch`](./packages/workflows/noresearch), [`docs/workflow.md`](./docs/workflow.md) | RPIV execution workflow, local Research workflow, and platform workflow contract |
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
pi --research    # intentional research workflow (or: pi --research "topic")
pi --pm          # research, planning, and sync persona
pi --dev         # implementation and verification focus
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
- **Sync Android skills**: `./scripts/sync-android-skills.sh`

## 🤝 Attribution

- Powered by [Pi Coding Agent](https://pi.dev).
- Context compression by [Headroom](https://github.com/headroom-ai/headroom).
- Terse mode inspired by [Caveman](https://github.com/JuliusBrussee/caveman).

---

**[nothing](https://github.com/raquezha/nothing)** — Built for local-first agentic autonomy.
