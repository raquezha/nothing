# WORK: feat(nochestra): tag worker sessions and correlate Notrace token accounting

## [INTAKE]
### Outcome
Parent track: #139 ## Outcome Correlate parent and worker context usage in Notrace by tagging sub-process worker runs with `role: "worker"` and linking `parentSessionId`. ## Scope 1. Pass parent session identifier to sub-process worker environment (`NOCHESTRA_PARENT_SESSION_ID`)....

### Acceptance Criteria
- [ ] Confirm concrete acceptance criteria from tracker or refine them during `/frame`.

### Scope / Non-goals
- Keep local execution state concise; do not copy raw tracker or CLI rendering into `WORK.md`.

### Dependencies / Blockers
- None noted from intake snapshot.

### Tracker Context
- Task: `github:146`
- URL: https://github.com/raquezha/nothing/issues/146
- Tracker updated: `2026-08-25T06:27:45Z`

## [BRIEF]
- Type: Proposal
- Source: `github:146`
- Evidence Category: Backend-safe
- Evidence Status: n/a
- Understanding: Sub-process worker runs spawned by nochestra need context usage correlation with parent sessions without merging worker prompt history into parent context or polluting token metrics.
- Desired Outcome: Tag worker sub-processes with `NOCHESTRA_PARENT_SESSION_ID` and `role: "worker"`, enabling Notrace to separate worker and parent token accounting while allowing independent inspection.
- Constraints / Non-goals:
  - Real-time token streaming UI.
  - Cross-session analytics dashboard changes.
- Acceptance Criteria:
  - [ ] Worker sub-processes carry `NOCHESTRA_PARENT_SESSION_ID` and `role: "worker"`.
  - [ ] Notrace records parent and worker token accounting separately.
  - [ ] Worker token usage does not corrupt or duplicate parent context metrics.
  - [ ] Telemetry tests verify session role tagging and correlation.

## [GRILL]
- Evidence classification verified: Backend-safe, status n/a. No UI or formula evidence gate applies.
- Code reality: `packages/workflows/nochestra/executor-dispatch.mjs` currently spawns workers with only `NOCHESTRA_WORKER="1"`; it does not pass `NOCHESTRA_PARENT_SESSION_ID`, `NOCHESTRA_ROLE`, or worker correlation IDs.
- Code reality: `packages/notrace/extensions/notrace/adapters.ts` already reads `NOCHESTRA_*` correlation env vars and task role, but correlation lacks `parentSessionId` and only records supplied fields.
- Code reality: `packages/notrace/extensions/notrace/index.ts` already stores `task.role`, `session.role`, `correlation`, and per-session activity totals/context snapshots, so separation should stay session-record based rather than merging worker logs into parent records.
- Docs alignment: `docs/agents/notrace.md` says Notrace observes supplied Nochestra fields and does not control worker lifecycle; `docs/nochestra/PRODUCT.md` requires parent and worker context accounting as initial scope.
- Impact surface: worker dispatch/env construction, Nochestra worker tests, Notrace correlation types/extraction tests, and Notrace record/report consumers that show correlation.
- Decision: smallest viable path is to add parent-session correlation to existing env/correlation plumbing and tests; do not add analytics dashboard changes or transcript merging.
- Risk for /plan: define the parent session source explicitly; likely use existing env/session id when available, not a new persistent parent registry.

## [PLAN]
- [ ] Slice 1 (AFK): Propagate worker identity/env from Nochestra dispatch.
  - Change `spawnWorkerProcess` env construction to set `NOCHESTRA_ROLE="worker"` and pass `NOCHESTRA_PARENT_SESSION_ID` from the parent session source.
  - Parent session source: use explicit `parentSessionId` option first, then existing parent env `NOCHESTRA_SESSION_ID` / `PI_SESSION_ID` if present; do not create a registry.
  - Add/update Nochestra dispatch tests proving worker env includes role and parent session id.
  - Verify: `node --test packages/workflows/nochestra/test/executor-dispatch.test.mjs`
- [ ] Slice 2 (AFK): Extend Notrace correlation schema for parent session links.
  - Add `parentSessionId` to `NotraceCorrelationInfo` and `extractCorrelation`, sourced from `NOCHESTRA_PARENT_SESSION_ID` or record content.
  - Keep parent and worker accounting as separate session records; only link them by correlation fields.
  - Add/update Notrace correlation tests for worker role plus parent session id.
  - Verify: `npm test --workspace packages/notrace -- --runInBand` or package-local equivalent if the repo script differs.
- [ ] Slice 3 (AFK): Surface correlation without dashboard expansion.
  - Ensure existing report/session summary can display `parentSessionId` where correlation pills are already rendered, if not already covered by generic JSON/record output.
  - Verify no worker events are appended to parent prompt history or parent Notrace record.
  - Verify: `npm test --workspace packages/notrace` and `npm test --workspace packages/workflows/nochestra`.
- [ ] Slice 4 (HITL): Review tracker/package release hygiene.
  - If code changes package contents, add a changeset and sync GitHub issue progress before implementation PR.
  - Verify: `npm test`, `./bootstrap.sh --dry-run`, `npm run changeset:status`.

## [LOG]
- 2026-08-25 02:27 PM: Task initialized via /triage
- 2026-08-25 02:28 PM: Framed task brief via /frame
- 2026-08-25 02:31 PM: Grilled brief against Nochestra and Notrace docs/code
- 2026-08-25 02:33 PM: Planned worker correlation implementation slices
- 2026-08-25 02:35 PM: Synced planned state to GitHub issue #146 via Pi status comment
- 2026-08-25 02:40 PM: Implemented slice 1 worker env propagation and added coverage for worker role/parent session envs

## [META]
- Branch: `feat/146`
- Status: `active`
- Phase: `planned`
- Source: `github:146`
