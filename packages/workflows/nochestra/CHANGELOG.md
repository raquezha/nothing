# @raquezha/nochestra

## 0.2.1

### Patch Changes

- a38c08d: Fix Nochestra unsupported delivery action route pattern matching with model override arguments.
- ed6c584: Fix release closer package listing and expand repository manifest verifications.
- 4c28252: Fix writer lock release cleanup error handling and notrace cleanup directory walk resilience.
- 737e88d: Format worker delegation spawning and result completion cards into clean open-right border boxes.
- 4388a75: Implement Solution 2 compact Powerline badge formatting for worker delegation and result display.

## 0.2.0

### Minor Changes

- 2340c8d: feat(nochestra): implement Notrace context quarantine telemetry and efficiency reporting
- 258e6a6: feat(nochestra): default read-only worker handoffs to no writer lock

### Patch Changes

- 98caf2f: feat(nochestra): add interactive front-door extension for prompt route recommendation
- 720a744: Harden vault note distillation, frontmatter parsing, and wiki-link validation in the Nochestra worker runtime.
- 36d4be1: Implement interactive checkpoint CLI subcommands (`status`, `show`, `compact`, `reset`, `prune`) in Nochestra parent runtime. Refs #196
- 25f77ce: Implement multi-model tier dispatch routing lightweight tasks to local fast models and heavy tasks to cloud premium models.
- 1aa0972: Implement self-healing worker remediation routing and blocker recovery in parent-runtime.mjs. Refs #197
