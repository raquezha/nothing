# nodesign

Standalone design context extractor and preflight CLI for AI agents (Pi, Claude Code, Cursor, Aider) and UI developers.

`nodesign` allows any developer or AI agent framework to authenticate, inspect design sources (Figma, Zeplin), and extract typography, colors, layout specs, and frame renders into structured context or `--json` payloads.

It also powers deterministic design preflight for `norpiv` workflows (`nodesign preflight`).

---

## Quick Start

### 1. Authenticate

Interactive terminal prompt with PAT creation guidance:

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

## Commands

### `auth login`
Prompt or save PAT credentials for Figma and Zeplin.

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
