# nodesign

Standalone design context extractor and preflight CLI for AI agents (Pi, Claude Code, Cursor, Aider) and UI developers.

`nodesign` allows any developer or AI agent framework to authenticate, inspect design sources (Figma, Zeplin), and extract typography, colors, layout specs, and frame renders into structured context or `--json` payloads.

It also powers deterministic design preflight for `norpiv` workflows (`nodesign preflight`).

> **Experiment disclaimer:** you probably do not need `nodesign` if your agent already has a good Figma MCP or Zeplin MCP in the same runtime. `nodesign` exists as a portable CLI contract: one command agents can run anywhere, with normalized Figma/Zeplin output and preflight checks.

| Need | nodesign | Zeplin MCP | Figma MCP |
| --- | ---: | ---: | ---: |
| Figma + Zeplin in one command | Yes | No | No |
| Works outside MCP runtimes (shell, CI, Cursor, Claude Code, Aider) | Yes | No | No |
| Normalized JSON shape across providers | Yes | Zeplin only | Figma only |
| Auth helper/token lookup from env, keychain, config | Yes | MCP-managed | MCP-managed |
| Preflight for missing or ambiguous design links | Yes | No | Depends |
| Design extract plus render from a CLI | Yes | Partial | Depends |

Use the native MCP first when it is enough. Use `nodesign` only when portability, normalization, or preflight is the actual problem.

---

## Installation & Setup

### 1. Authentication for Private Files
Most company Figma files and Zeplin screens are private and require a Personal Access Token (PAT). Run authentication once to save your credentials securely:

```bash
# Interactive setup (stores token securely in OS Keychain / Secret Service / User config)
npx @raquezha/nodesign auth login

# Or pass tokens directly via environment variables:
export FIGMA_TOKEN="figd_xxx"
export ZEPLIN_TOKEN="zpl_xxx"
```

### 2. Execution

#### Instant Execution (No global install required)
```bash
# Uses credentials saved during `auth login` or env variables automatically:
npx @raquezha/nodesign extract "<design-url>"
```

#### Global CLI Install (Recommended for AI Agents & Terminal Devs)
```bash
npm install -g @raquezha/nodesign
```

> **Note on Private Files:** `nodesign` automatically resolves credentials from `process.env`, local `.env`, `~/.pi-secrets/.env`, OS Keychain (macOS / Linux), or `~/.config/nodesign/config.json`. If no token is found for a private file, `nodesign` returns a clear `AUTH_REQUIRED` status.

---

## Quick Start

### 1. Authenticate

Interactive terminal prompt with Personal Access Token (PAT) creation guidance:

```bash
nodesign auth login
```

Non-interactive / CI flag mode:

```bash
nodesign auth login --provider figma --token "figd_xxx"
nodesign auth login --provider zeplin --token "zpl_xxx"
```

Check credential status and API validity:

```bash
nodesign auth status
```

### 2. Extract Design Context

Extract colors, typography, layout specs, and component hierarchy:

```bash
nodesign extract "https://www.figma.com/design/KEY/FileTitle?node-id=1-2"
nodesign extract "https://zpl.io/AOGOKp6" --json
```

Download frame screenshot / render asset to disk:

```bash
nodesign extract "https://www.figma.com/design/KEY/FileTitle?node-id=1-2" --render --out ./renders
```

---

## Agent Integration Cheatsheet

Include these snippets in your system instructions or project rules for AI agents:

### General System Prompt Instruction
> "When given a Figma or Zeplin link for UI work, run `nodesign extract <url> --json` to inspect colors, typography, layout specs, and frame structure before planning UI changes."

### Pi Agent / Custom Scripts
```bash
nodesign extract "https://www.figma.com/design/KEY/Title?node-id=1-2" --json
```

### Claude Code / Cursor / Aider CLI
```bash
nodesign auth status
nodesign extract "<design-url>" --render --out .workflow/tasks/active/evidence
```

---

## Multi-OS Credential Storage

`nodesign` checks credentials in the following hierarchy:
1. `FIGMA_TOKEN` / `ZEPLIN_TOKEN` environment variables
2. `.env` file in current working directory
3. `~/.pi-secrets/.env`
4. OS Keychain (macOS Keychain via `security` / Linux Secret Service via `secret-tool`)
5. User config file (`~/.config/nodesign/config.json` with restricted `0600` permissions)

Output reports the exact source:
- macOS: `Saved figma token to OS keychain`
- Linux: `Saved figma token to OS keychain`
- Fallback / Headless: `Saved figma token to config file (~/.config/nodesign/config.json)`

---

## Konsist-Style Architectural & Symbol Harvester

`nodesign` incorporates a lightweight **Konsist-Style Architectural Harvester** inspired by structural linting engines like [Konsist](https://docs.konsist.lemonappdev.com/) and [ArchUnit](https://www.archunit.org/).

### How It Works

Instead of relying on hardcoded folder names (`domain/`, `data/`, `presentation/`), `nodesign` scans class declarations, function signatures, annotations, and usage patterns across your codebase:

1. **Architectural Signal Detection**:
   - **Clean Architecture**: Detects `*UseCase`, `*Interactor`, `*Repository`, `*Gateway`, `*Port`, and `*Adapter` declarations.
   - **Design System Modules**: Detects `:designsystem`, `core:ui`, `ui/theme/`, `Color.kt`, `Theme.kt`, and `@Composable fun *Theme`.
   - **Feature & Layer Structures**: Detects `feature/*/`, `screens/`, `viewmodels/`, `*ViewModel`, `*State`, `*Intent`.
2. **Deep Custom Theme Token Discovery**:
   - Deep-scans custom theme wrappers (`TapatTheme.colors`, `LocalColors.current`, `val PrimaryBlue = Color(...)`).
   - Automatically harvests package names (`package com.app.ui.theme`) and injects required Kotlin `import` statements into generated `@Composable` code.
3. **Usage-Based Component Catalog**:
   - Scans codebase invocation patterns (e.g. `PrimaryButton(...)` used 14x across production screens).
   - Instructs AI coding agents to reuse existing project Composables instead of generating duplicate code or raw primitives.
4. **Zero-Setup Portability**:
   - Runs out-of-the-box via `npx @raquezha/nodesign` without requiring Gradle plugins or external linter dependencies.

---

## Commands

### `auth login`
Prompt or save Personal Access Token (PAT) credentials for Figma and Zeplin.

Flags:
- `--provider <figma|zeplin>`
- `--token <pat>`

### `auth status`
Show active credential sources and validate reachability (`valid`, `invalid`, `unreachable`).

### `extract`
Extract design specs from a Figma or Zeplin URL or URI (`zpl://`).

Flags:
- `--json` machine-readable JSON output
- `--render` download frame screenshot
- `--out <dir>` target output directory for renders/assets

### `preflight` (RPIV Integration)
Inspect project directory and design evidence for RPIV workflow gates.

```bash
nodesign preflight --path . --task github:101
nodesign preflight --json --path . --task jira:ANDROID-123
```

---

## Development & Test

```bash
cd packages/nodesign
npm install
npm test
```
