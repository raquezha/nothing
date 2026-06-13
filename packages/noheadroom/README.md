# @raquezha/noheadroom

Personal Pi extension for using a local Headroom Docker backend from `nothing`.

## Status

Experimental but working in my local proof flow.

```text
pi --headroom -p --tools read "Read big JSONL..."
-> 🗜 noheadroom: compressed 9,863 → 4,320 tokens (-56%, saved 5,543, messages 1)
```

## Why this exists

The upstream Ryan extension (`@ryan_nookpi/pi-extension-headroom`) successfully connects Pi to Headroom, but my tests showed Pi built-in tool names such as `read` and `bash` can route as `excluded_tool` in Headroom and save 0 tokens.

A direct A/B test used the same payload and changed only the tool name:

```text
tool=read      -> saved=0, excluded_tool
tool=bash      -> saved=0, excluded_tool
tool=read_data -> saved=70988, smart_crusher
```

So this package adapts the compression payload sent to Headroom while preserving Pi's original metadata locally.

## How it works

```text
Pi messages
  -> noheadroom copies messages into OpenAI-shaped compression payload
  -> assistant tool call name becomes neutral pi_tool_result in the copy
  -> Headroom /v1/compress can route/compress tool output
  -> noheadroom applies only compressed text back to original Pi toolResult
  -> original Pi tool ids/names/details/images stay preserved
```

Important: the tool-name adaptation happens only in the compression request copy. It does not rewrite the real Pi session tool metadata.

## Visible indicators

When compression applies, noheadroom shows:

1. a terminal / print-mode line
2. Pi notification/footer status
3. persistent Pi custom message entry (`customType=noheadroom.compression`)

Example:

```text
🗜 noheadroom: compressed 19,692 → 8,598 tokens (-56%, saved 11,094, messages 2)
```

## Backend

Expected local backend:

```text
http://127.0.0.1:8788
```

Use repo scripts:

```bash
./scripts/headroom-up.sh
./scripts/headroom-health.sh
./scripts/headroom-down.sh
```

## Settings

Reads the same settings file shape as the upstream extension:

```text
~/.pi/agent/headroom/settings.json
```

Default in this repo:

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

`autoStart=false` because Docker/scripts own backend startup.

## Attribution

Based on `@ryan_nookpi/pi-extension-headroom` from `Jonghakseo/pi-extension`, MIT licensed. Upstream README snapshot is kept in `UPSTREAM-README.md`.
