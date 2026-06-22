---
"@raquezha/noheadroom": patch
---

fix: add lenient health check mode for air-gapped environments

When HEADROOM proxy's upstream is unreachable, strict health check blocks
compression even though /v1/compress works. Added healthStrategy option
('strict' | 'lenient') to bypass upstream check and probe compression directly.

Refs #14