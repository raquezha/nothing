# notrace: Retrospective Memory

This document stores durable technical memory and design rules for `notrace`.

## Core thesis

**Traces in, lessons out.**

`notrace` is a retrospective engine.
It exists to answer questions like:
- Is this workflow variant actually better?
- Did this extension reduce cost or friction?
- What changed between two sessions?

## Ownership boundary

`notrace` owns the **durable retrospective record**.
It does not own:
- Pi's live footer
- Pi's resume/session UX
- ad hoc terminal presentation strings

When shutdown output appears mixed together, treat `notrace`, Pi core, and dynamic extensions as separate producers unless the run record explicitly aggregates them.

## Architectural principles

1. **Local-first and private**
   - traces stay local
   - generated reports can still contain sensitive data
2. **Evidence vs. judgment**
   - evidence: `notrace.json`
   - judgment: `notrace.review.json`
3. **Unified storage**
   - retrospective artifacts live under `.notrace/`
4. **Workflow attachment, not workflow ownership**
   - `notrace` may attach links into workflow state such as `WORK.md`
   - `.notrace/` still owns retrospective artifacts
5. **Canonical schema first**
   - runtime, HTML, compare, review, and verification should all align to one versioned run-record model
6. **Harness-ready design**
   - Pi is adapter 1 today
   - schema and telemetry contracts should avoid unnecessary Pi-only assumptions so future harness adapters remain possible

## Capture modes

Current default is **full** unless `NOTRACE_CAPTURE` is set.

Supported modes:
- `full`
- `redacted`
- `metadata`

Use `redacted` or `metadata` when reduced sensitivity is more important than deep debugging.
Use `full` when debugging local extension/runtime behavior and you accept the higher sensitivity.

## Metric families

Keep these separate:
- **core session usage**: tokens, cost, turns, tool calls, errors, duration
- **optimization telemetry**: compression attempts, guard skips, tokens saved, transforms applied
- **presentation-only output**: footer badges, live status strings, resume hints

Never mix consumed tokens and saved tokens into one ambiguous total.

## Dynamic extension telemetry

Optional dynamic extensions may contribute structured telemetry.
Current first-class example is `noheadroom`.

Rules:
- absence of an extension must not break `notrace`
- extension telemetry should arrive through a structured contract
- do not scrape UI strings for canonical evidence
- prefer side-channel integration over conversation/session mutation during compression-sensitive flows

## Retrospective spine

A session is complete only when it follows the spine:
1. capture
2. inspect
3. review
4. compare

## Mandatory protocol

- Never commit `.notrace/` or `.workflow/`.
- Link, do not copy, retrospective artifacts into workflow docs.
- If a durable repo rule emerges from repeated retrospective lessons, promote it into repo docs or `AGENTS.md`.
