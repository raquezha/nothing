# nochestra

Local-first Nochestra entrypoint scaffold and implementation home for `nothing`.

`nochestra` is intentionally **not published as an npm package yet**. It is a local workflow bundle loaded by the optional `pi --nochestra` hat while Nochestra's control plane proves itself.

## Purpose

Nochestra is an optional control plane for Pi (`pi --nochestra`).

This folder is the canonical local implementation home established in GitHub issue #94. It holds the entrypoint scaffold, skill wiring, and helper logic used during rollout.

## Layout

```text
packages/workflows/nochestra/
  nochestra/SKILL.md
  README.md
```

## Commands

```bash
pi --nochestra
```

## Relationship to other workflows

- `pi --nochestra` is an optional entrypoint.
- Existing workflows (`pi --rpiv`, `pi --research`, `pi --notes`) remain unchanged.
- Product brief lives at `docs/nochestra/PRODUCT.md`.
