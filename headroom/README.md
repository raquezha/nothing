# Headroom Backend 🗜

> **Local context compression engine.** This directory contains the Docker and service configuration for the Headroom proxy used by the `nothing` setup.

## 🏗 Role

This directory manages the **backend service** (the compressor). It is separate from the **Pi extension** (`packages/noheadroom`), which handles the communication between Pi and this service.

| Component | Responsibility |
|---|---|
| `headroom/` | Manages the Docker container and proxy runtime. |
| `packages/noheadroom/` | Adapts Pi context and sends it to the proxy. |

## 🚀 Quick Start

### 1. Launch the Backend

```bash
./scripts/headroom-up.sh
```

This starts the `nothing-headroom` container on `127.0.0.1:8788`.

### 2. Verify Health

```bash
./scripts/headroom-health.sh
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
  "autoStart": false
}
```

---

**[nothing](https://github.com/raquezha/nothing)** — Local-first agentic development setup.
