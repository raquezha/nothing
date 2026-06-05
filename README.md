# nothing

A minimal, cross-platform configuration and dotfiles bootstrapper for macOS and Linux. It installs the Pi Coding Agent, registers the `nothing` mindset, dynamically integrates official Android skills via MCP, and loads packaged shareable tools like `notrace` from NPM, avoiding update drift and setup bloat.

## 🚀 Installation & Bootstrapping

To set up your environment, clone this repository and run the bootstrapper:

```bash
git clone https://github.com/raquezha/nothing.git
cd nothing
./bootstrap.sh
```

The script automatically detects your operating system, configures your agent home directory, installs published extensions, links bundled skills, and wires the shell hats.

## Shareable skill bundles

Some folders can also be installed independently from npm:

```bash
npm install -g @raquezha/norpiv @raquezha/nosearch
norpiv-install --target pi
nosearch-install --target pi
```

Supported installer targets:

```bash
norpiv-install --target pi|claude|codex|all
nosearch-install --target pi|claude|codex|all
```

`pi` and `claude` install native `SKILL.md` folders. `codex` installs the same docs plus an `AGENTS.md` adapter because Codex-style environments do not universally auto-load skill bundles.
