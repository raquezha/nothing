# @raquezha/noheadroom

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
