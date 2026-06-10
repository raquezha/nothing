# @raquezha/noleaks

## 0.0.4

### Patch Changes

- b56dfd2: Restructure extension entrypoints into package-named index directories so Pi displays clean extension labels without `.ts` suffixes.
- f2959b5: Hardened noleaks with a 3-tier security model (max, basic, off), output scrubbing (DLP), symlink resolution, and the /noleaks command for stats and mode switching.
- f2959b5: Harden noleaks with broader protected credential locations, cwd-aware and home-expanded path checks, safer path containment, secret-looking write/edit payload blocking, environment dump blocking, sensitive shell variable detection, and network-exfiltration guardrails.

## 0.0.3

### Patch Changes

- 2ab1520: Fix skill conflicts by auto-expanding skill collections in shell integration.
  Standardize extension structure by moving entrypoints to conventional extensions/ directories. This allows Pi to auto-discover them and display clean labels (e.g., "noagy") without file extensions in the UI.

## 0.0.2

### Patch Changes

- 2673c7c: Declare Pi package resources, fix nosearch packaged skill lookup, and harden notrace HTML data embedding.
