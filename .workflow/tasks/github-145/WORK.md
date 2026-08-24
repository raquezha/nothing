# WORK: feat(nochestra): add worker persona extension and handoff ingestion

## [INTAKE]
### Outcome
Parent track: #139 ## Outcome Add the Nochestra worker persona extension (`pi --nochestra-worker` or worker loader) to ingest handoff JSON packets and enforce compact structured output without context file accumulation. ## Scope 1. Implement worker handoff reader: parse handoff J...

### Acceptance Criteria
- [ ] Confirm concrete acceptance criteria from tracker or refine them during `/frame`.

### Scope / Non-goals
- Keep local execution state concise; do not copy raw tracker or CLI rendering into `WORK.md`.

### Dependencies / Blockers
- None noted from intake snapshot.

### Tracker Context
- Task: `github:145`
- URL: https://github.com/raquezha/nothing/issues/145
- Tracker updated: `2026-08-24T05:12:02Z`

## [BRIEF]
- Type: Proposal
- Source: `github:145`
- Evidence: Backend-safe, n/a
- Current understanding: Add a Nochestra worker persona path that accepts a handoff packet from stdin or `--handoff`, builds a bounded worker prompt from the packet, disables context file accumulation, and returns compact validated JSON on stdout.
- Desired outcome: A worker-only execution mode that reliably ingests handoff JSON and emits `{ status, taskId, summary, nextStep }` for parent orchestration.
- Constraints / non-goals: Do not include parent transcript turns in the worker prompt. Do not handle parent context management or direct CLI route classification here. Keep rollback simple by allowing fallback to plain Pi prompt execution.
- Acceptance hints: Support `pi --nochestra-worker` or equivalent worker loader, support `--handoff`, enforce `--no-context-files`, validate output schema, and cover ingestion/output validation with tests.

## [GRILL]
- Evidence check: Backend-safe work; evidence status remains `n/a`.
- Confirmed existing foundation: `packages/workflows/nochestra/executor-dispatch.mjs` already has bounded handoff construction, compact worker result validation, writer-lock enforcement, subprocess spawning, stdin/file handoff transport, `--no-context-files` injection, model flag passing, timeout supervision, and fallback handling.
- Confirmed existing contract: compact worker result is already enforced as `{ status, taskId, summary, nextStep }` via `validateCompactWorkerResult` in `packages/workflows/nochestra/jira-triage-proof.mjs` and reused by executor dispatch.
- Confirmed product/doc alignment: `docs/nochestra/PRODUCT.md` requires bounded worker handoffs without parent transcript replay and compact structured worker results; current dispatch code already matches that shape.
- Impact surface: worker persona work will touch Nochestra CLI/entry routing, likely `dotfiles/shell_integration.sh`, `config/mindsets.json`, repo verification in `scripts/verify-repo.mjs`, and Nochestra README/docs if a new public flag/hat is added.
- Gap found: there is no current `--nochestra-worker`, `--handoff-file`, or worker-only loader in repo routing. Existing subprocess dispatch writes a temp file and passes `--handoff`, but no Pi-side worker entrypoint consumes it yet.
- Constraint carried into plan: reuse existing handoff/result validation code instead of inventing a second schema or worker protocol.
- Constraint carried into plan: support bounded prompt construction from handoff fields only; do not replay parent transcript or load context files.
- Decision: canonical file handoff flag is `--handoff`; do not add `--handoff-file`.
- Risk: adding a new top-level hat has wider shell/docs/test fallout than adding a worker loader behind existing Nochestra plumbing.

## [PLAN]
- [x] Cleanup Slice 1 (AFK): Remove the worker handoff schema fork.
  - Move shared contract constants to one Nochestra module, or reuse the existing nearest owner if already present.
  - Source of truth must cover forbidden transcript/context fields and compact worker result keys.
  - Update `buildBoundedHandoff`, `validateCompactWorkerResult`, and worker ingestion to use the shared contract instead of local duplicate arrays.
  - Verify: `node --test packages/workflows/nochestra/test/worker-handoff.test.mjs packages/workflows/nochestra/test/executor-dispatch.test.mjs packages/workflows/nochestra/test/jira-triage-proof.test.mjs`
- [x] Cleanup Slice 2 (AFK): Make prompt building data-driven without hardcoded protocol field mirrors.
  - Render allowed handoff keys generically after validation.
  - Keep a tiny presentation order only if it is derived from/shared with the handoff builder contract; otherwise use object order from the validated packet.
  - Keep both `expectedResultShape` and `resultSchema` support only if existing upstream producers still emit both; otherwise normalize to one field at read time.
  - Verify: worker handoff tests assert no transcript fields render and unknown safe bounded fields are preserved.
- [x] Cleanup Slice 3 (AFK): Update PR and docs to describe the actual contract owner.
  - Document `--handoff` as transport, not schema definition.
  - Update PR body after cleanup commit.
  - Verify: `npm test`, `./bootstrap.sh --dry-run`, `npm run changeset:status`, `shellcheck dotfiles/shell_integration.sh bootstrap.sh`.

## [LOG]
- 2026-08-24 01:12 PM: Task initialized via /triage
- 2026-08-24 01:13 PM: Framed task as Proposal from GitHub issue acceptance criteria; backend-safe evidence only.
- 2026-08-24 01:16 PM: Grilled Nochestra docs and code; confirmed dispatch/validation primitives exist and the missing piece is worker-side CLI ingestion/routing.
- 2026-08-24 01:18 PM: Planned four thin slices for worker ingestion, routing, validation, and docs/changeset.
- 2026-08-24 01:19 PM: Corrected handoff file flag to canonical `--handoff`; no `--handoff-file` alias planned.
- 2026-08-24 01:21 PM: Narrowed Matt Pocock `/handoff` influence to hygiene only: temp storage, pointer-heavy payloads, and redaction; worker JSON protocol remains Nochestra-specific.
- 2026-08-24 01:24 PM: Replanned to keep Matt Pocock `/handoff` as hygiene only and leave loader shape to the smallest implementation path.
- 2026-08-24 01:31 PM: GitHub issue status not changed; no repository-specific In Progress mapping found. Implemented Slice 1 worker ingestion helpers test-first. Verification passed: `node --test packages/workflows/nochestra/test/worker-handoff.test.mjs packages/workflows/nochestra/test/executor-dispatch.test.mjs`; `npm test`; `npm run changeset:status`.
- 2026-08-24 01:34 PM: Committed Slice 1 as `0f3e277` and opened draft PR https://github.com/raquezha/nothing/pull/155.
- 2026-08-24 02:38 PM: Implemented remaining slices after human LGTM: `pi --nochestra-worker` routing, context-file isolation, verification coverage, docs, and bootstrap help. Verification passed: `node --test packages/workflows/nochestra/test/worker-handoff.test.mjs packages/workflows/nochestra/test/executor-dispatch.test.mjs`; `npm test`; `./bootstrap.sh --dry-run`; `npm run changeset:status`; `shellcheck dotfiles/shell_integration.sh bootstrap.sh`. Committed as `fec71f0` and updated draft PR https://github.com/raquezha/nothing/pull/155.
- 2026-08-24 02:42 PM: Fixed CI Changeset status by adding empty no-release changeset marker `70b494a`; all PR checks now pass.
- 2026-08-24 02:47 PM: Replanned cleanup after review: remove hardcoded worker schema fork, share Nochestra handoff contract, and make prompt rendering data-driven.
- 2026-08-24 03:06 PM: Implemented cleanup: added shared `handoff-contract.mjs`, rewired handoff/result validation to use it, removed prompt field mirror, and documented contract ownership. Verification passed: `node --test packages/workflows/nochestra/test/worker-handoff.test.mjs packages/workflows/nochestra/test/executor-dispatch.test.mjs packages/workflows/nochestra/test/jira-triage-proof.test.mjs`; `npm test`; `./bootstrap.sh --dry-run`; `npm run changeset:status`; `shellcheck dotfiles/shell_integration.sh bootstrap.sh`. Committed as `f520831` and updated draft PR https://github.com/raquezha/nothing/pull/155.
- 2026-08-24 03:08 PM: Verified cleanup complete; all plan slices checked, repo gates and PR checks green, no AI-artifact regressions found.
- 2026-08-24 03:14 PM: Refactored the contract layer into a single `NOCHESTRA_HANDOFF_CONTRACT` object with policy functions; regenerated worker prompt output from the shared contract and re-ran verification (`node --test packages/workflows/nochestra/test/worker-handoff.test.mjs packages/workflows/nochestra/test/executor-dispatch.test.mjs packages/workflows/nochestra/test/jira-triage-proof.test.mjs`; `npm test`; `npm run changeset:status`).

## [META]
- Branch: `feat/145`
- Status: `active`
- Phase: `triaged`
- Source: `github:145`
