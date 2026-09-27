# Headroom Backend 🗜

> **Local context compression engine.** This directory contains the Docker and service configuration for the Headroom proxy used by the `nothing` setup. Powered by the original [Headroom](https://github.com/headroomlabs-ai/headroom) project.

## 🏗 Role

This directory manages the **backend service** (the compressor). It is separate from the **Pi extension** (`packages/noheadroom`), which handles the communication between Pi and this service.

| Component | Responsibility |
|---|---|
| `headroom/` | Manages the Docker container and proxy runtime. |
| `packages/noheadroom/` | Adapts Pi context and sends it to the proxy. |

## 🚀 Quick Start

### For `nothing` Users

```bash
./scripts/headroom-up.sh
```

This starts the `nothing-headroom` container on `127.0.0.1:8788`.

### For Standalone Users

If you just want the backend without cloning this whole repository:

```bash
docker run -d \
  --name headroom-proxy \
  -p 127.0.0.1:8788:8787 \
  -v headroom-data:/data \
  -e HEADROOM_TELEMETRY=off \
  -e HEADROOM_BEACON=off \
  -e HEADROOM_SAVINGS_PATH=/data/proxy_savings.json \
  ghcr.io/headroomlabs-ai/headroom:0.39.1 \
  --host 0.0.0.0 --port 8787 --mode cache --lossless --no-cache
```

### Verify Health

**Via script (`nothing` users):**
```bash
./scripts/headroom-health.sh
```

**Via curl (standalone):**
```bash
curl http://127.0.0.1:8788/health
```

## 🛠 Service Details

- **Image**: `ghcr.io/headroomlabs-ai/headroom:0.39.1`
- **Port**: `8788` (Internal `8787`)
- **Data Persistence**: Stats are stored in `${HOME}/.local/share/headroom`.
- **Mode**: `cache` with `--lossless` (marker-free, conservative compaction); `--no-cache` disables proxy response caching.

## 🔧 Configuration

The proxy is configured via `headroom/compose.yml`. Both local telemetry and the separately controlled anonymous beacon are disabled; data is stored locally. The `/v1/compress` endpoint is marker-free by default in 0.39.1.

Pi extension settings should point to this backend:

```json
{
  "baseUrl": "http://127.0.0.1:8788",
  "autoStart": false,
  "mode": "normal"
}
```

The `mode` field controls output verbosity: `normal` (all output), `quiet` (suppress routine compression notices), or `silent` (suppress all non-critical output). Override via `PI_HEADROOM_MODE` env var.

---

**[nothing](https://github.com/raquezha/nothing)** — Local-first agentic development setup.
