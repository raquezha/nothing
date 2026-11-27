---
name: headroom
description: Monitor, configure, and inspect Headroom local context compression in Pi. Use for checking compression status, proxy health, live stats, or toggling headroom on/off.
---

# Skill: headroom

Use the `@raquezha/noheadroom` extension and its slash commands to manage context compression for long Pi coding sessions.

## Quick Commands (Slash Commands)

Run these directly in the Pi prompt:

- `/headroom` or `/headroom status` — Render the full session compression status and savings report.
- `/headroom health` or `/headroom-health` — Probe the local Headroom proxy (`127.0.0.1:8788`) and display connection state.
- `/headroom stats` — Display raw backend metrics from the proxy `/stats` endpoint.
- `/headroom on` — Enable context compression for the current session and ensure the proxy is running.
- `/headroom off` — Disable context compression for the session (leaves the backend proxy running).
- `/headroom mode <normal|quiet|silent>` — Switch notification verbosity (`normal` displays all savings announcements, `quiet` suppresses routine announcements, `silent` suppresses all notices).

## Backend Container Management

When the proxy is not running, manage it via repo scripts:

```bash
./scripts/headroom-up.sh      # Start the local Docker backend (ghcr.io/headroomlabs-ai/headroom:0.39.1)
./scripts/headroom-health.sh  # Verify HTTP health (http://127.0.0.1:8788/health)
./scripts/headroom-down.sh    # Stop the Docker backend
```

## How Compression Works

1. **Pi Policy & Safety**:
   - Only eligible `toolResult` outputs $\ge 2,000$ characters are compressed.
   - Protected tools (`read`, `read_file`, `view`, `edit`, `write`, `skill`, `headroom_retrieve`) always stay 100% raw to prevent corrupting code edits.
   - Android layout UI dumps (`resource-id` check) always stay 100% raw.
2. **Prompt Cache Stability**:
   - Pi uses `context_with_system` so the leading system prompt is never rebuilt, keeping provider prompt cache prefixes warm.
   - Compression decisions are persisted into session history (`noheadroom.decision`). On session reload or `/resume`, decisions replay byte-for-byte with 0 proxy calls.
   - Past answered tool results are frozen as passthrough while the provider prompt cache is warm, and re-evaluated only when compaction makes the cache cold.
3. **Trailing Truncation Note Preservation**:
   - `\n\n[Showing lines X-Y of Z...]` is isolated before proxy compression and re-attached verbatim so Headroom folds logs without misclassifying them as mixed content.
