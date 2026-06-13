# Headroom backend

Local Headroom proxy for the personal `nothing` Pi setup.

## Role

This directory configures the Headroom backend runtime. It is not the Pi extension package.

| Path | Role |
|---|---|
| `headroom/` | run/configure Headroom backend |
| `packages/noheadroom/` | later Pi extension package |

## Phase 1 shape

```text
Pi + @ryan_nookpi/pi-extension-headroom
  -> http://127.0.0.1:8788/v1/compress
  -> nothing-headroom Docker container
```

Normal Pi model routing stays unchanged during this phase.

## Commands

```bash
./scripts/headroom-up.sh
./scripts/headroom-health.sh
./scripts/headroom-down.sh
```

## Pi extension settings

Install to `~/.pi/agent/headroom/settings.json`:

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

`autoStart=false` because Docker owns the backend.
