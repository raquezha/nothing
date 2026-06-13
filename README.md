# nothing

Personal Pi setup for local-first agentic development. It wires my Pi hats, local workflow skills, published Pi extensions, optional third-party compression, and vendored Android skills into one reproducible repo.

> ⚠️ **Personal reset warning:** do not run `./bootstrap.sh` from a fork/shared machine unless you want your agent environment reset. It asks for Yes/No confirmation, then archives/resets global Pi discovery dirs (`~/.pi/agent/{skills,extensions,prompts,themes}` and `~/.agents/skills`) so plain `pi` comes up clean except for the always-on `noleaks` guard.

Core rule: **owned skills stay local**. Public handoff uses `npx skills add` or npm packages; my day-to-day workflow uses this checkout and shell hats.

## What this repo contains

| Area | Path / package | Purpose |
|---|---|---|
| Shell hats | `dotfiles/shell_integration.sh` | `pi --rpiv`, `--android`, `--dev`, `--pm`, `--notes`, etc. |
| Mindsets | `mindsets.json` | Declarative local skill/extension sets. |
| Headroom | `headroom/` | Local Docker backend for context compression. |
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

Bootstrap installs baseline tools, Pi, fresh settings, builds this checkout's packages, installs shell integration, and archives/resets existing global Pi skills/extensions/prompts/themes after confirmation. It does not globally link first-party or third-party skills by default; hats load repo-local skills intentionally.

Reload shell after bootstrap:

```bash
source ./dotfiles/shell_integration.sh
```

## Hats and modifiers

Base hats load repo-local skills:

```bash
pi --nothing     # ultimate nothing: blank system prompt; no built-in tools, skills, prompt templates, themes, or context files; still keeps noleaks on
pi --rpiv        # full local RPIV workflow
pi --android     # RPIV execution helpers + local android-cli skill
pi --pm          # research/planning/sync persona
pi --dev         # implementation/verification persona
pi --meta        # skill/setup/meta engineering persona
pi --write       # docs/writing helper persona
pi --notes       # conversation distiller; saves useful thinking to Obsidian without RPIV ceremony
```

Modifiers are additive experiments:

```bash
pi --rpiv --caveman        # lazy-installs caveman skills into ~/.local/share/nothing on first use
pi --android --caveman
pi --android --rtk          # lazy-installs pi-rtk-optimizer into ~/.local/share/nothing on first use
pi --rpiv --headroom        # starts local Headroom Docker backend for compression
pi --rpiv --caveman --rtk --headroom
```

Combo presets are aliases for base hats plus modifiers:

```bash
pi --tkmx                   # tokenmaxxing; equivalent to: pi --antigravity --caveman --rtk --headroom
```

Rules:

- one base hat per invocation
- combo presets still count as their underlying base hat
- modifiers never replace local first-party skill loading
- `--nothing` wins and runs with `--system-prompt '' --no-builtin-tools --no-skills --no-extensions --no-prompt-templates --no-themes --no-context-files`, then re-adds the always-on `noleaks` extension
- `--rtk` is experimental and explicit; it lazy-installs/loads the RTK optimizer only for that invocation
- `--headroom` starts/uses the local Headroom Docker backend on `127.0.0.1:8788` and loads repo-local `packages/noheadroom`

## Try only the skills with `npx skills add`

Use this when handing off skills to other people/agents. This does **not** install my full personal setup.

RPIV workflow skills:

```bash
npx -y skills add raquezha/nothing --full-depth -g -a pi \
  -s triage frame grill-with-docs plan implement verify sync cleanup update-docs distill \
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
| `@raquezha/noheadroom` | Headroom compression bridge for Pi + local Docker backend |

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
