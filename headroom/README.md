# Headroom Backend 🗜

> **Local context compression engine.** This directory contains the Docker and service configuration for the Headroom proxy used by the `nothing` setup. Powered by the original [Headroom](https://github.com/headroom-ai/headroom) project.

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
  -e HEADROOM_SAVINGS_PATH=/data/proxy_savings.json \
  ghcr.io/chopratejas/headroom:latest \
  --host 0.0.0.0 --port 8787 --no-cache
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

- **Image**: `ghcr.io/chopratejas/headroom:latest`
- **Port**: `8788` (Internal `8787`)
- **Data Persistence**: Stats are stored in `${HOME}/.local/share/headroom`.
- **Mode**: `token` (optimized for maximum reduction).

## 🔧 Configuration

The proxy is configured via `headroom/compose.yml`. Environmental defaults are set to disable telemetry and point to a local data volume.

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
