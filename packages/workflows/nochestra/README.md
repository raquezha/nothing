# nochestra

Local-first Nochestra entrypoint scaffold and implementation home for `nothing`.

`nochestra` is intentionally **not published as an npm package yet**. It is a local workflow bundle loaded by the optional `pi --nochestra` hat while Nochestra's control plane proves itself.

## Purpose

Nochestra is an optional control plane for Pi (`pi --nochestra`).

This folder is the canonical local implementation home established in GitHub issue #94. It holds the entrypoint scaffold, skill wiring, and helper logic used during rollout.

## Layout & Dependency Rules

Nochestra follows a Functional Core plus Ports/Adapters architecture:

```text
packages/workflows/nochestra/
  domain/                 # Pure rules, contracts, and policies (zero external IO)
    checkpoint-contract.mjs
    delivery-command.mjs
    handoff-contract.mjs
    handoff-policy.mjs
  application/            # Orchestration and use cases
    executor-dispatch.mjs
    parent-epoch.mjs
    parent-runtime.mjs
    worker-handoff.mjs
    worker-runtime.mjs
  adapters/               # File IO, process spawning, writer lock, env integration
    checkpoint.mjs
    process-runner.mjs
    writer-lock.mjs
  nochestra/SKILL.md
  README.md
  test/
    checkpoint-contract.test.mjs
    delivery-command.test.mjs
    executor-dispatch.test.mjs
    jira-triage-proof.test.mjs
    parent-epoch.test.mjs
    parent-runtime.test.mjs
    worker-handoff.test.mjs
    worker-runtime.test.mjs
```

**Dependency Rule:**
```text
adapters -> application -> domain
domain -> nothing
```

Root `.mjs` files are retained only as tiny backward-compatible re-export shims for external CLI entrypoints and legacy callers.

## Commands

```bash
pi --nochestra
pi --nochestra-worker --handoff /tmp/nochestra-handoff.json
```

`pi --nochestra-worker` loads the Nochestra worker skill with `--no-context-files` so worker runs start from the bounded handoff instead of accumulated repo context files. The canonical file handoff flag is `--handoff`; stdin ingestion is supported by the worker handoff helpers for process-level callers.

`pi --nochestra /triage <source>:<id>` routes through a parent runtime (`application/parent-runtime.mjs`) that builds bounded handoff from current task/checkpoint state, spawns a fresh worker subprocess, and prints only a compact result plus next action.

## Route recommendations

Nochestra route recommendation is deterministic and non-dispatching. It evaluates named grammar rules, reports the matching rule in `reason`, and falls back to Chat when input does not match a complete rule.

Supported recommendation grammar:

| Input shape | Route | Command | Reason |
| --- | --- | --- | --- |
| `triage github:123` | `delivery` | `/triage github:123` | `rule:delivery-triage-ref` |
| `implement github:123` | `delivery` | `null` | `rule:delivery-unsupported-action-ref` |
| `research model routing options` | `discovery` | `pi --research` | `rule:discovery-explicit-research` |
| `write this to notes` | `notes` | `pi --notes` | `rule:notes-write-destination` |
| `research this and write it to notes` | `needs-confirmation` | `null` | `rules:...` |
| `hello` | `chat` | `null` | `rule:chat-fallback` |

A `command` is an executable suggestion only. Unsupported delivery actions can recommend the Delivery route, but they do not invent slash commands. Bare questions (`how are you?`) and vague durable prompts (`save this`) stay Chat.

Recommendation output shape:

```json
{
  "kind": "route-recommendation",
  "route": "delivery",
  "command": "/triage github:123",
  "confidence": "high",
  "reason": "rule:delivery-triage-ref"
}
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
