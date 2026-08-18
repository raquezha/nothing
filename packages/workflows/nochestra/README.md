# nochestra

Local-first Nochestra entrypoint scaffold and implementation home for `nothing`.

`nochestra` is intentionally **not published as an npm package yet**. It is a local workflow bundle loaded by the optional `pi --nochestra` hat while Nochestra's control plane proves itself.

## Purpose

Nochestra is an optional control plane for Pi (`pi --nochestra`).

This folder is the canonical local implementation home established in GitHub issue #94. It holds the entrypoint scaffold, skill wiring, and helper logic used during rollout.

## Layout

```text
packages/workflows/nochestra/
  checkpoint.mjs
  nochestra/SKILL.md
  README.md
  test/
    checkpoint-contract.test.mjs
    fixtures/
      checkpoint.json
```

## Commands

```bash
pi --nochestra
```

## Relationship to other workflows

- `pi --nochestra` is an optional entrypoint.
- Existing workflows (`pi --rpiv`, `pi --research`, `pi --notes`) remain unchanged.
- Product brief lives at `docs/nochestra/PRODUCT.md`.

## Telemetry & Context Accounting

Nochestra relies on Notrace (`@raquezha/notrace`) to observe session evidence without modifying active conversation context:
- Context accounting records active tokens, peak active context, model context window, and message count per session.
- Session/task role markers (`role: "parent"` | `"worker"`) allow distinguishing parent context from dispatched worker runs.
- Missing provider metrics are represented as unavailable (`null`) rather than invented.
- Measurement evidence supports future checkpointing and epoch policies without establishing a hard permanent cross-provider schema.

## Rolling Checkpoint Contract

Nochestra maintains a single replaceable rolling checkpoint contract (`checkpoint.mjs`):
- Overwrites active state in place rather than appending or accumulating transcript/turn history.
- Preserves subject, goal, accepted decisions, constraints, open questions, rejected options, current route, and suggested next route.
- Isolates accepted truth from raw transcript turns.
- Final storage path, worker dispatch, and public schema remain provisional.
