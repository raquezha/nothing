---
"@raquezha/noheadroom": patch
"@raquezha/nocapture": patch
---

Add prompt cache preservation and session durability inspired by twKrash/pi-headroom:
- Switch to `context_with_system` to prevent system prompt cache rebuilding
- Persist compression decisions via `pi.appendEntry` and rehydrate on session start/resume
- Isolate trailing truncation notes before compression and restore them verbatim
- Freeze warm answered past tool results while cache is warm; re-evaluate when cache is cold
- Add `x-client: pi` header for local Headroom dashboard attribution
