# noheadroom 🗜

> **Reclaim your Pi context window.** A local-first context compression bridge for the Pi Coding Agent, powered by [Headroom](https://github.com/headroomlabs-ai/headroom).

`noheadroom` sits between Pi and your LLM, using Headroom to shrink massive tool outputs/results and logs before they become model input. Headroom itself is a general prompt/context compression engine that can transform broader request material. `noheadroom` deliberately applies a stricter Pi policy: user prompts and assistant messages may be sent as context for the compression request, but Pi only accepts mutations to `toolResult` content. User chat, assistant text, tool-call metadata, and tool IDs remain unchanged in real Pi history. Save tokens, keep more history, and prevent context-overflow in long sessions.

## 🚀 Why noheadroom?

Headroom intentionally protects file reads: changing source text can break exact-match edits. `noheadroom` keeps those reads raw and compresses eligible large text-only tool results (for example, repetitive logs). It never changes the stored Pi session transcript.

## ✨ Features

- **Headroom Bridge, Pi Policy**: Headroom can optimize broad prompt/context payloads; `noheadroom` intentionally narrows what gets applied back to Pi so only `toolResult` content mutates.
- **Tool Fidelity & Safety**: Protected tools (`read`, `read_file`, `view`, `edit`, `write`, `skill`, etc.) and Android UI layout dumps always stay raw to protect exact code-editing anchors.
- **Prompt Cache Stability**: Hooks Pi's `context_with_system` to leave the leading system message intact and prevent prompt cache invalidation. Past answered tool results stay frozen while the provider cache is warm.
- **Session Durability & Replay**: Stores compression decisions into custom session branch entries (`noheadroom.decision`). Replaying across `/resume` or process restarts matches byte-for-byte with 0 proxy calls.
- **Truncation Note Isolation**: Isolates Pi's trailing `\n\n[Showing lines X-Y of Z...]` note before compression and restores it verbatim after, preserving log classifier accuracy and full output paths.
- **Chat Transcript Rendering**: Slash commands (`/headroom`, `/headroom stats`) render rich Dracula-themed status cards directly in the session transcript without polluting LLM token context.
- **Bundled Agent Skill**: Ships `"skills": ["headroom"]` so agents know how to inspect health, toggle modes, and manage the backend.
- **Docker-First Architecture**: designed to work seamlessly with a local containerized backend (`127.0.0.1:8788`).
- **Local-First Privacy**: by default, context never leaves your machine.

## 📦 Installation

### Within the `nothing` Monorepo

`noheadroom` is built-in. Start Pi with compression enabled:

```bash
pi --headroom
# OR full tokenmaxxing:
pi --tkmx
```

### Standalone (NPM)

```bash
pi install npm:@raquezha/noheadroom
```

## 🛠 Usage

### Backend Setup

`noheadroom` requires a Headroom proxy running on `127.0.0.1:8788`. Use the provided scripts in the `nothing` repo:

```bash
./scripts/headroom-up.sh      # Launch Docker backend
./scripts/headroom-health.sh  # Verify connection
```

### Commands

Inside Pi, use the `/headroom` command:

- `/headroom` or `/headroom status` — Render the session compression status and savings report.
- `/headroom on` | `off` — Toggle compression live.
- `/headroom health` — Check if the backend is alive.
- `/headroom stats` — Inspect raw backend metrics from the proxy.
- `/headroom mode <normal|quiet|silent>` — Switch notification verbosity.

## 🔧 Configuration

Settings are stored in `~/.pi/agent/headroom/settings.json`:

```json
{
  "enabled": true,
  "baseUrl": "http://127.0.0.1:8788",
  "autoStart": false,
  "mode": "normal",
  "minContextTokens": 10000,
  "minMessageChars": 2000
}
```

- **`autoStart`**: Set to `false` when using the Docker backend.
- **`mode`**: `normal` (all output), `quiet` (suppress routine success), or `silent` (suppress all non-critical notices). Override with `PI_HEADROOM_MODE=quiet`.
- **`minContextTokens`**: Compression kicks in once the context reaches this size.

## 🛡 Privacy & Security

Context is sent only to `localhost` (`127.0.0.1`) by default. Remote proxies are strictly blocked unless `PI_HEADROOM_ALLOW_REMOTE=1` is explicitly set in your environment.

## 🤝 Attribution

This project is a fork of [@ryan_nookpi/pi-extension-headroom](https://github.com/Jonghakseo/pi-extension/tree/main/packages/headroom) by [Ryan/Jonghakseo](https://github.com/Jonghakseo), modified to support Pi-specific tool-result adaptation. Licensed under MIT.

---

**[nothing](https://github.com/raquezha/nothing)** — Local-first agentic development setup.
