---
"@raquezha/nodesign": patch
---

Synchronize `.env` and `~/.pi-secrets/.env` credential entries on `nodesign auth login` and `logout` to prevent stale `.env` files from shadowing new stored tokens.
