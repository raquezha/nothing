# nothing

Personal Pi setup for local-first agentic development. It wires my Pi hats, local workflow skills, published Pi extensions, optional third-party compression, and vendored Android skills into one reproducible repo.

> ⚠️ **Personal reset warning:** do not run `./bootstrap.sh` from a fork/shared machine unless you want your agent environment reset. It archives/resets global Pi discovery dirs (`~/.pi/agent/{skills,extensions,prompts,themes}` and `~/.agents/skills`) so plain `pi` behaves like a fresh install for me.

Core rule: **owned skills stay local**. Public handoff uses `npx skills add` or npm packages; my day-to-day workflow uses this checkout and shell hats.

## What this repo contains

| Area | Path / package | Purpose |
|---|---|---|
| Shell hats | `dotfiles/shell_integration.sh` | `pi --rpiv`, `--android`, `--dev`, `--pm`, etc. |
| Mindsets | `mindsets.json` | Declarative local skill/extension sets. |
| RPIV skills | `packages/norpiv/` | Triage → frame → grill → plan → implement → verify → sync. |
| Meta skills | `packages/nometa/` | Skill creation, repo bootstrap, nothing maintenance. |
| Search skills/ext | `packages/nosearch/` | Brave/Firecrawl subagent + bundled skills. |
| Pi extensions | `packages/notrace`, `noleaks`, `noagy`, `nofooter` | Trace viewer, secret guard, Antigravity provider, footer UI. |
| Android skills | `vendor/android-skills/` | Local snapshot of official `android/skills`; `--android` starts with `android-cli`. |

## Install my full setup

Fresh machine / my personal setup:

```bash
git clone https://github.com/raquezha/nothing.git
cd nothing
./bootstrap.sh
```

Bootstrap installs baseline tools, Pi, fresh settings, builds this checkout's packages, installs shell integration, and archives/resets existing global Pi skills/extensions/prompts/themes. It does not globally link first-party or third-party skills by default; hats load repo-local skills intentionally.

Reload shell after bootstrap:

```bash
source ./dotfiles/shell_integration.sh
```

## Hats and modifiers

Base hats load repo-local skills:

```bash
pi --nothing     # ultimate nothing: no skills, extensions, or context files
pi --rpiv        # full local RPIV workflow
pi --android     # RPIV execution helpers + local android-cli skill
pi --pm          # research/planning/sync persona
pi --dev         # implementation/verification persona
pi --meta        # skill/setup/meta engineering persona
pi --write       # docs/writing helper persona
```

Modifiers are additive experiments:

```bash
pi --rpiv --caveman        # lazy-installs caveman skills into ~/.local/share/nothing on first use
pi --android --caveman
pi --android --rtk          # lazy-installs pi-rtk-optimizer into ~/.local/share/nothing on first use
pi --rpiv --caveman --rtk
```

Rules:

- one base hat per invocation
- modifiers never replace local first-party skill loading
- `--nothing` wins and runs with `--no-skills --no-extensions --no-context-files`
- `--rtk` is experimental and explicit; it lazy-installs/loads the RTK optimizer only for that invocation

## Try only the skills with `npx skills add`

Use this when handing off skills to other people/agents. This does **not** install my full personal setup.

RPIV workflow skills:

```bash
npx -y skills add raquezha/nothing --full-depth -g -a pi \
  -s triage frame grill-with-docs plan implement verify sync cleanup update-docs \
  -y
```

Meta/setup skills:

```bash
npx -y skills add raquezha/nothing --full-depth -g -a pi \
  -s agent-os pi-skill-creator nothing-bootstrap nohtml \
  -y
```

Search skills:

```bash
npx -y skills add raquezha/nothing --full-depth -g -a pi \
  -s brave-search firecrawl \
  -y
```

Everything discoverable in this repo:

```bash
npx -y skills add raquezha/nothing --full-depth -g -a pi -s '*' -y
```

## Install published npm packages

Skill bundles:

```bash
npm install -g @raquezha/norpiv @raquezha/nosearch
norpiv-install --target pi
nosearch-install --target pi
```

Pi extensions/packages:

```bash
pi install npm:@raquezha/notrace
pi install npm:@raquezha/noleaks
pi install npm:@raquezha/noagy
pi install npm:@raquezha/nofooter
```

For this personal checkout, hats normally load the local built packages instead of installed npm copies.

| Package | Purpose |
|---|---|
| `@raquezha/norpiv` | RPIV skill bundle + installer |
| `@raquezha/nosearch` | Search extension + Brave/Firecrawl skills + installer |
| `@raquezha/notrace` | local HTML trace viewer |
| `@raquezha/noleaks` | secret/credential guard |
| `@raquezha/noagy` | Antigravity model provider |
| `@raquezha/nofooter` | footer/theme/status UI |

## Android skills snapshot

No Android MCP. No global Android skill dependency.

`vendor/android-skills/` is a local snapshot of official `android/skills`. Refresh manually when wanted:

```bash
./scripts/sync-android-skills.sh
git diff -- vendor/android-skills
git add vendor/android-skills
git commit -m "chore: refresh android skills snapshot"
```

## Validate setup

```bash
./bootstrap.sh --dry-run
npm install
npm run build --workspaces --if-present
npm test
npm run verify:notrace
```

CI should be green:

```bash
gh run list --limit 5
```

## Release notes

This repo uses Changesets for npm package versioning. If pending changesets exist but GitHub Actions cannot create PRs, the publish workflow skips cleanly. To enable normal Version PR flow, allow GitHub Actions to create PRs in repo settings.
