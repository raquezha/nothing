---
name: nochestra
description: "Optional Nochestra control-plane entrypoint scaffold."
---

# Skill: nochestra

Optional entrypoint scaffold for Nochestra control-plane rollout.

## Purpose

Provides the initial loadable scaffold for `pi --nochestra` without modifying existing direct workflow hats or inventing runtime APIs prematurely.

## Worker mode

When loaded via `pi --nochestra-worker`, use only the supplied bounded handoff packet (`--handoff <file>` or stdin) as task context. Do not replay parent transcripts or accumulated context files. Return only compact JSON with keys `status`, `taskId`, `summary`, and `nextStep`.
