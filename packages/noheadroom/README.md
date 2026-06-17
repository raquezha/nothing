# noheadroom 🗜

> **Reclaim your Pi context window.** A local-first context compression bridge for the Pi Coding Agent, powered by [Headroom](https://github.com/headroom-ai/headroom).

`noheadroom` sits between Pi and your LLM, shrinking massive tool results and logs before they reach the model. Save tokens, keep more history, and prevent context-overflow in long sessions.

## 🚀 Why noheadroom?

Upstream Headroom protects common agent tool names like `read` and `bash` by default. In a standard Pi workflow, this means large file reads often bypass compression entirely.

`noheadroom` adapts the compression payload to bypass these exclusions while **fully preserving your Pi session metadata**.

| Setup | Tool Name | Headroom Action | Savings |
|---|---|---|---|
| Vanilla | `read` | `excluded_tool` | 0% |
| **noheadroom** | `read` | `smart_crusher` | **60-90%** |

## ✨ Features

- **Adaptive Payload Sanitization**: renames tool calls during compression to ensure Headroom actually shrinks them.
- **Strict Candidate Isolation**: limits payload mutation strictly to `toolResult` messages, safely ignoring upstream proxy mangling of assistant history to prevent false-positive guard skips.
- **Turn-by-Turn Loop Prevention**: caches candidate-specific fingerprints to block useless proxy retries across new conversational turns if previous attempts yielded zero savings or skipped.
- **Pi-Native Metadata Preservation**: original tool IDs and names are never modified in your real session.
- **Deep Visibility**: compression results appear in your terminal, the Pi footer, and as persistent entries in your session history.
- **Docker-First Architecture**: designed to work seamlessly with a local containerized backend.
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

- `/headroom` — Session statistics and status summary.
- `/headroom on` | `off` — Toggle compression live.
- `/headroom health` — Check if the backend is alive.
- `/headroom stats` — Inspect raw backend metrics.

## 🔧 Configuration

Settings are stored in `~/.pi/agent/headroom/settings.json`:

```json
{
  "enabled": true,
  "baseUrl": "http://127.0.0.1:8788",
  "autoStart": false,
  "minContextTokens": 10000,
  "minMessageChars": 2000
}
```

- **`autoStart`**: Set to `false` when using the Docker backend.
- **`minContextTokens`**: Compression kicks in once the context reaches this size.

## 🛡 Privacy & Security

Context is sent only to `localhost` (`127.0.0.1`) by default. Remote proxies are strictly blocked unless `PI_HEADROOM_ALLOW_REMOTE=1` is explicitly set in your environment.

## 🤝 Attribution

This project is a fork of [@ryan_nookpi/pi-extension-headroom](https://github.com/Jonghakseo/pi-extension/tree/main/packages/headroom) by [Ryan/Jonghakseo](https://github.com/Jonghakseo), modified to support Pi-specific tool-result adaptation. Licensed under MIT.

---

**[nothing](https://github.com/raquezha/nothing)** — Local-first agentic development setup.
