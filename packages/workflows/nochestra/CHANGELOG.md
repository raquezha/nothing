# @raquezha/nochestra

## 0.2.4

### Patch Changes

- Fix formatNochestraResult: correct artifact fallback label, model fallback label, and deduplicate status variable.

## 0.2.3

### Patch Changes

- Fix three bugs in nochestra extension: null-coalesce cwd, skip remediation prompt on stdin to prevent hang, improve error message to include command name.

## 0.2.2

### Patch Changes

- Add nochestra extension entry to mindsets.json extensions array so pi --nochestra loads the extension.

## 0.2.1

### Patch Changes

- 47d94e4: Fix Nochestra unsupported delivery action route pattern matching with model override arguments.
- ed13430: Enable direct sub-agent worker process dispatch and Powerline badge rendering for interactive Nochestra session inputs.
- 21c0cef: Auto-approve interactive Nochestra write dispatches and return action handled to stop parent LLM token consumption.
- b48ac1b: Fix Nochestra mindset skill list and pass --no-skills to shell integration to prevent TUI skill interception and token burn.
- a31046f: Include RPIV workflow skills and extensions in Nochestra mindset configurations.
- 45b48e1: Add route recommendation rules for Nochestra stage commands (/frame, /grill-with-docs, /plan, /implement, /verify, /sync, /refine) to prevent chat fallback.
- cf1a779: Fix release closer package listing and expand repository manifest verifications.
- 8336e24: Fix writer lock release cleanup error handling and notrace cleanup directory walk resilience.
- c89411f: Format worker delegation spawning and result completion cards into clean open-right border boxes.
- f4c23a2: Register Nochestra stage commands natively with pi.registerCommand to guarantee zero LLM token burn.
- 272ae25: Implement Solution 2 compact Powerline badge formatting for worker delegation and result display.

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
