# nofooter

Powerline-style CLI footer theme and branch editor for the Pi Coding Agent. Renders a rich, color-coded status bar with live token counts, cost, context window usage, and the current Git branch — styled in either **Dracula Vibrant** or **Ghostly Pale** palette.

## Features

- **Powerline footer**: Input tokens 🟢, output tokens 🟣, cache reads 🟡, cost 🟠, context window usage 🔵
- **Branch editor border**: Active Git branch shown in the top-right of the editor frame; active model + provider in the bottom-right
- **Theme cycling**: `/cycle-theme` command toggles between `dracula-vibrant` and `ghostly-pale`
- **Auto-updates**: Branch name refreshes on every session start

## Usage

```bash
# Load directly
pi --extension ./packages/nofooter

# Via nothing mindset (dev, rpiv)
pi --dev
```

## NPM

```bash
npm install -g @raquezha/nofooter
```

## Palettes

| Token | Vibrant | Pale |
|---|---|---|
| Background | `#282a36` | `#1e1f29` |
| Input | `#50fa7b` | `#8da88d` |
| Output | `#bd93f9` | `#9b9bc0` |
| Cache | `#f1fa8c` | `#b8b88d` |
| Cost | `#ffb86c` | `#a8968d` |
| Context | `#8be9fd` | `#8da8a8` |
