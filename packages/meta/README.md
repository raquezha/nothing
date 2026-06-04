# meta (Pi System & Agent-OS Engineering)

System utilities, skill creation frameworks, and monorepo bootstrapping automations designed to manage and scale the coding agent infrastructure.

## 🛠 Skills Checklist

This package exposes the following meta skills:

- **`pi-skill-creator`**: Automated generator that reads guidelines or examples to scaffold and compile new reusable Pi skills under `pi/skills/` (using standard structures, SKILL.md specs, and references).
- **`agent-os`**: Dynamic bootstrapper to seed any empty or undocumented codebase with `AGENTS.md` and `CONTEXT.md`. Establishes immediate context-loading rules for incoming agents.
- **`nothing-bootstrap`**: Deploy, migrate, and verify the `nothing` monorepo configuration (NPM global packages, loader scripts, settings) on Zsh or Bash shells across macOS and Linux setups.

---

## 🚀 Usage

Load this toolkit dynamically by launching the agent with the Meta flag:

```bash
pi --meta
```

Or target specific skills in your prompt:
```text
/agent-os
```

To configure a new machine with the `nothing` monorepo:
```text
/nothing-bootstrap
```
