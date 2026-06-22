# @raquezha/noheadroom

## 0.2.4

### Patch Changes

- faa9c4f: fix: add lenient health check mode for air-gapped environments

  When HEADROOM proxy's upstream is unreachable, strict health check blocks
  compression even though /v1/compress works. Added healthStrategy option
  ('strict' | 'lenient') to bypass upstream check and probe compression directly.

  Refs #14

## 0.2.3

### Patch Changes

- 8f31379: fix(noheadroom): match lowercase footer casing
  feat(notrace): add session export to HTML retrospective
- 4249ec6: fix(noheadroom): avoid stale Pi TUI working rows and same-length fingerprint collisions

## 0.2.2

### Patch Changes

- 51fda83: fix: preserve assistant toolCall blocks in noheadroom compression and expose notrace failure metadata
- 3b54a3e: Restrict Pi-applied Headroom mutations to `toolResult` content and suppress repeated guard-skip retries using eligible candidate fingerprints with stable content hashes.

  Refs #10

- 49932bc: Update the android hat mindset and headroom bypass rules.

## 0.2.1

### Patch Changes

- 6eac69d: Relocate core configuration files (`mindsets.json`, `settings.json`, `AGENTS.md`) to a dedicated `config/` directory for better maintainability and a cleaner repository root. Updated `bootstrap.sh` and shell integration to support the new layout.

## 0.2.0

### Minor Changes

- 01478ca: Initial release of the Headroom compression bridge for Pi. Includes:
  - Adaptive payload sanitization to bypass tool exclusion lists.
  - Mirror Guard to prevent infinite context preparation loops.
  - Persistent in-session compression stats.

## 0.0.2

### Patch Changes

- 0d65b37: Initial release of the Headroom compression bridge for Pi.
