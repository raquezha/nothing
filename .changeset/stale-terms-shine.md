---
"@raquezha/noheadroom": minor
---

fix(noheadroom): Naturalize Headroom compression hints

- Keeps the upstream `pi_tool_result` bridge behavior because local tests did not prove a routing or fidelity benefit from renaming tool calls.
- Translates Headroom retrieve-hash markers into Pi-native `read` offset/limit hints so agents do not chase unusable retrieval hashes.
- Documents the remaining merge blocker: code-fidelity guard must reject unsafe `kompress` output when compressed code loses declarations.

Refs #39
