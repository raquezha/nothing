# @raquezha/noheadroom

Personal Pi extension for using a local Headroom Docker backend from `nothing`.

## Status

Experimental but working.

```text
pi --headroom -p --tools read "Read big JSONL..."
-> 🗜 noheadroom: compressed 9,863 → 4,320 tokens (-56%, saved 5,543, messages 1)
```

## Why this exists

The upstream Ryan extension (`@ryan_nookpi/pi-extension-headroom`) successfully connects Pi to Headroom, but my tests showed Pi built-in tool names such as `read` and `bash` can route as `excluded_tool` in Headroom and save 0 tokens.

A direct A/B test proved that the Headroom proxy protects/skips these common agent tool names:

```text
tool=read      -> saved=0, excluded_tool
tool=bash      -> saved=0, excluded_tool
tool=read_data -> saved=70,988, smart_crusher
```

`@raquezha/noheadroom` adapts the compression payload to bypass these exclusions while preserving original Pi metadata locally.

## How it works

1. **Copy**: copies Pi messages into an OpenAI-shaped compression payload.
2. **Sanitize**: renames assistant tool calls to a neutral name (`pi_tool_result`) in the copy.
3. **Compress**: sends the sanitized payload to Headroom `/v1/compress`.
4. **Restore**: applies only the compressed text back to the original Pi `toolResult` messages.

**Result**: Pi's original tool IDs, names, details, and images stay preserved in your session history, but you get the token savings of Headroom compression.

## Install

### Inside `nothing` repo (Personal)

Loaded automatically via shell modifiers:

```bash
pi --headroom
pi --tkmx
```

### Outside repo (NPM)

```bash
pi install npm:@raquezha/noheadroom
```

## Backend

Expected local backend on port `8788`. Use `nothing` repo scripts to manage the Docker service:

```bash
./scripts/headroom-up.sh      # Start Docker backend
./scripts/headroom-health.sh  # Check status/stats
./scripts/headroom-down.sh    # Stop backend
```

## Commands

- `/headroom` — show current status and session stats.
- `/headroom on` — enable compression.
- `/headroom off` — disable compression for this session.
- `/headroom health` — check if the backend proxy is online.
- `/headroom stats` — print the backend's `/stats` JSON.
- `/headroom-health` — shortcut for health check.

## Visible Indicators

When compression is applied, `noheadroom` provides feedback in three places:

1. **Terminal/Print-mode**: explicit `🗜 noheadroom: compressed ...` stderr line.
2. **Pi UI**: notification and status footer showing token reduction percentage.
3. **Session History**: persistent `custom_message` with `customType=noheadroom.compression`.

## Privacy

Compression is performed by sending context to a proxy. By default, `noheadroom` only allows `localhost`, `127.0.0.1`, and `::1`. Remote proxies are blocked unless `PI_HEADROOM_ALLOW_REMOTE=1` is set.

## Settings

Managed in `~/.pi/agent/headroom/settings.json`.

```json
{
  "enabled": true,
  "baseUrl": "http://127.0.0.1:8788",
  "autoStart": false,
  "minContextTokens": 10000,
  "minMessageChars": 2000,
  "timeoutMs": 30000
}
```

- `autoStart`: should be `false` if using the Docker setup.
- `minContextTokens`: skip compression until context reaches this size.
- `minMessageChars`: only compress tool results larger than this.

## Development

```bash
npm install
npm run build --workspace @raquezha/noheadroom
```

## Attribution

Derived from `@ryan_nookpi/pi-extension-headroom` by [Jonghakseo/pi-extension](https://github.com/Jonghakseo/pi-extension), MIT licensed. Upstream README snapshot in `UPSTREAM-README.md`.
