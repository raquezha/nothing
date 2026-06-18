# noheadroom 🗜

> **Reclaim your Pi context window.** A local-first context compression bridge for the Pi Coding Agent, powered by [Headroom](https://github.com/headroom-ai/headroom).

`noheadroom` sits between Pi and your LLM, using Headroom to shrink massive tool outputs/results and logs before they become model input. Headroom itself is a general prompt/context compression engine that can transform broader request material. `noheadroom` deliberately applies a stricter Pi policy: user prompts and assistant messages may be sent as context for the compression request, but Pi only accepts mutations to `toolResult` content. User chat, assistant text, tool-call metadata, and tool IDs remain unchanged in real Pi history. Save tokens, keep more history, and prevent context-overflow in long sessions.

## 🚀 Why noheadroom?

Upstream Headroom protects common agent tool names like `read` and `bash` by default. In a standard Pi workflow, this means large file reads often bypass compression entirely.

`noheadroom` adapts the compression payload to bypass these exclusions while **fully preserving your Pi session metadata**.

| Setup | Tool Name | Headroom Action | Savings |
|---|---|---|---|
| Vanilla | `read` | `excluded_tool` | 0% |
| **noheadroom** | `read` | `smart_crusher` | **60-90%** |

## ✨ Features

- **Headroom Bridge, Pi Policy**: Headroom can optimize broad prompt/context payloads; `noheadroom` intentionally narrows what gets applied back to Pi so only `toolResult` content mutates.
- **Adaptive Payload Sanitization**: renames tool calls during compression to ensure Headroom actually shrinks them.
- **Strict Candidate Isolation**: limits applied mutations strictly to `toolResult` messages, safely ignoring upstream proxy mangling of user/assistant history to prevent false-positive guard skips.
- **Turn-by-Turn Loop Prevention**: caches eligible `toolResult` candidate fingerprints using tool identity, content shape, length, and stable content hashes to block useless proxy retries across new conversational turns while still retrying when actual tool output changes.
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
