# AGENTS.md

## Project overview

`nothing` is a personal Pi coding-agent setup and package monorepo. It contains:

- local shell hats and mindsets for Pi (`bootstrap.sh`, `dotfiles/shell_integration.sh`, `mindsets.json`)
- RPIV workflow skills (`packages/norpiv`)
- meta/setup skills (`packages/nometa`)
- search skills and extension (`packages/nosearch`)
- Pi extensions (`packages/noagy`, `packages/noleaks`, `packages/notrace`, `packages/nofooter`)
- vendored Android skills snapshot (`vendor/android-skills`)

Core rule: owned skills stay local-first; public handoff uses npm packages or `npx skills add`.

## Setup commands

Use npm workspaces from the repo root.

```bash
npm install
npm run build --workspaces --if-present
npm test
npm run verify:notrace
./bootstrap.sh --dry-run
```

Fresh local setup:

```bash
./bootstrap.sh
source ./dotfiles/shell_integration.sh
```

## Validation checklist

Before finishing non-trivial changes, run the relevant subset and prefer the full set:

```bash
npm run build --workspaces --if-present
npm test
npm run verify:notrace
./bootstrap.sh --dry-run
```

For shell changes, also run syntax checks:

```bash
bash -n bootstrap.sh scripts/*.sh packages/norpiv/scripts/*.sh packages/norpiv/implement/scripts/*.sh packages/norpiv/sync/*.sh packages/nosearch/*.sh packages/nosearch/*/*.sh
```

For publish/package changes, dry-run package contents:

```bash
npm pack --workspaces --dry-run --json
```

## Code style and repo conventions

- TypeScript packages are ESM unless their package says otherwise.
- Prefer `@earendil-works/*` Pi packages. Do not add deprecated `@mariozechner/pi-*` dependencies or imports.
- Extension entrypoints should be located in an `extensions/` directory and exposed as package-named directories with an `index.ts` entrypoint (e.g., `extensions/noagy/index.ts`). This ensures Pi auto-discovers them and displays a clean label (e.g., `noagy`) instead of a filename or "dist" in the UI. Build outputs should still be generated in `dist/` for standard Node.js/npm compatibility.
- Root `package-lock.json` owns workspace dependency state. Do not add nested package lockfiles.
- Use precise, minimal edits. Avoid rewriting large files without need.
- Keep generated outputs (`dist/`, `node_modules/`, `.reposcry/`, `.workflow/`) out of git.

## Simple ops questions

For machine/status/metric questions, do not inspect repo. Use one direct `bash` check and answer.

- current temperature/fans: `sensors`
- service state: `systemctl is-active NAME`
- disk/memory/load: `df -h`, `free -h`, `uptime`
- netdata named: `curl -fsS http://127.0.0.1:19999/api/v1/info`; if alive, query `/api/v1/charts` or `/api/v1/data`; if unavailable, say netdata cannot answer history and fall back to `sensors` only for current temp

## Pi hats and local workflow

Shell hats are implemented in `dotfiles/shell_integration.sh` and configured by `mindsets.json`.

Common hats:

```bash
pi --nothing
pi --rpiv
pi --dev
pi --pm
pi --meta
pi --android
pi --antigravity
```

Modifiers:

```bash
pi --rpiv --caveman
pi --android --rtk
```

Combo preset:

```bash
pi --tkmx   # tokenmaxxing = pi --antigravity --caveman --rtk
```

`--rtk` is experimental and explicit. It lazy-installs/loads the RTK optimizer from a local nothing cache for that invocation only; keep tests around this because command rewriting/compression can break pipes, exact reads, and edit anchors.

## RepoScry policy

RepoScry is optional support for RPIV repo-memory.

- `.reposcry/` is generated local cache and must never be committed.
- `.reposcry/` must be present in project `.gitignore` when RepoScry is initialized.
- `.reposcryignore` is indexing policy and may be committed after review.
- `packages/norpiv/scripts/reposcry-bootstrap.sh` enforces these guardrails.

Useful commands:

```bash
./packages/norpiv/scripts/reposcry-bootstrap.sh --force
./packages/norpiv/scripts/reposcry-task-context.sh "<task summary>"
./packages/norpiv/scripts/reposcry-refresh.sh main
reposcry --repo . stats
```

## Changesets and npm releases

This repo uses Changesets. Do not manually bump package versions for normal releases.

When package behavior, entrypoints, or dependencies change, **you must add a changeset**. AI agents should prefer creating a non-empty changeset that lists the affected packages.

```bash
npx changeset
```

If a PR intentionally has no package release (e.g., only internal scripts or docs changes), use:

```bash
npx changeset --empty
```

### AI Agent Instructions for Changesets

When editing any package under `packages/no*`:
1. **Identify affected packages**: Check which `package.json` files were modified.
2. **Create/Update changeset**: Ensure a `.changeset/*.md` file exists that includes all modified packages with an appropriate version bump (usually `patch`).
3. **Verify build**: Run `npm run build --workspaces` to ensure naming changes or dependency updates don't break the TypeScript compilation.


Release flow:

1. code + changeset merge to `main`
2. Changesets Action opens a Version PR
3. merging Version PR publishes npm packages

## Package maturity notes

- `@raquezha/norpiv`: usable workflow skills; needs stronger state-machine enforcement later.
- `@raquezha/nosearch`: usable search skill/extension bundle.
- `@raquezha/noagy`: experimental provider; be careful with OAuth/provider internals.
- `@raquezha/notrace`: Phase 0 / POC observability; generated reports may contain sensitive prompts/tool outputs.
- `@raquezha/noleaks`: Hardened credentials guard & DLP shield; supports /noleaks modes and output scrubbing.
- `@raquezha/nofooter`: UI/theme/status extension.

## Security considerations

- Never print, commit, or include secrets from `.env`, `.pi-secrets`, `.ssh`, auth files, keys, or tokens.
- Treat `notrace.html` outputs as sensitive local artifacts.
- `noleaks` is defense-in-depth only; do not rely on it as full exfiltration protection.
- Do not commit `.workflow/`, `.reposcry/`, `dist/`, `node_modules/`, logs, or local auth/config files.

## Android skills snapshot

The Android skills snapshot lives at:

```text
vendor/android-skills/
```

The sync workflow must update `vendor/android-skills/`, not `packages/android/`.

## PR and commit guidelines

- Use Conventional Commits, e.g. `fix(norpiv): guard reposcry cache`.
- Keep commits focused and reviewable.
- Include verification evidence in the final response.
- For AI-assisted commits in RPIV implementation work, follow the active `packages/norpiv/implement/SKILL.md` footer rules when applicable.
