# nothing

A minimal, cross-platform configuration and dotfiles bootstrapper for macOS and Linux. It installs the Pi Coding Agent, wires local-first mindsets, vendors official Android skills locally, and loads packaged shareable tools like `notrace` from NPM while keeping third-party optimizers optional.

## 🚀 Installation & Bootstrapping

To set up your environment, clone this repository and run the bootstrapper:

```bash
git clone https://github.com/raquezha/nothing.git
cd nothing
./bootstrap.sh
```

The script automatically detects your operating system, configures your agent home directory, installs published extensions, installs optional third-party skills like `caveman` via `npx skills`, links bundled local skills for discovery, and wires the shell hats.

## Hats and modifiers

Base hats load local repo skills:

```bash
pi --nothing
pi --rpiv
pi --android
pi --pm
pi --dev
pi --meta
```

Modifiers are additive experiments:

```bash
pi --rpiv --caveman
pi --android --caveman
pi --android --rtk
```

`--nothing` is the clean escape hatch and ignores additive modifiers. Android skills are vendored under `vendor/android-skills` and loaded locally by `pi --android`.

Refresh the vendored Android skills when needed:

```bash
./scripts/sync-android-skills.sh
```

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
