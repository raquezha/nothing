# nometa (Pi System & Agent-OS Engineering)

Local meta-skill collection for maintaining the `nothing` Pi setup, creating skills, and bootstrapping agent-friendly repos.

This package is intentionally local-first inside `nothing`. For public handoff, install the individual skills with `npx skills add`.

## Skills

| Skill | Purpose |
|---|---|
| `pi-skill-creator` | Create or improve Pi-native `SKILL.md` bundles with references/scripts. |
| `agent-os` | Seed or sync `AGENTS.md` and `CONTEXT.md` in a repo. |
| `nothing-bootstrap` | Bootstrap, migrate, or restore the `nothing` agent environment. |
| `nohtml` | Convert markdown/transcripts/plain text into self-contained HTML pages. |

## Use from the full nothing setup

```bash
pi --meta
```

Then invoke skills by intent, e.g.:

```text
/agent-os
/pi-skill-creator
/nothing-bootstrap
/nohtml
```

## Skills-only handoff with `npx skills add`

```bash
npx -y skills add raquezha/nothing --full-depth -g -a pi \
  -s agent-os pi-skill-creator nothing-bootstrap nohtml \
  -y
```
