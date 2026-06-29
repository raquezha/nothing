# nothing monorepo

Personal coding environment with Pi agent integrations.

## Standard Repository Patterns

### AGENTS.md Layer
- **Global baseline**: `~/AGENTS.md` (deployed by bootstrap from `config/AGENTS.md`)
  - Minimal tool hygiene rules for all projects
- **Project protocol**: This file (repo root)
  - Nothing-specific workflow, rules, and patterns

### Extension & Skill Structure (Pi)
Always use the nested directory pattern to ensure correct discovery and naming:
- **Extensions Source**: `packages/<name>/extensions/<name>/index.ts`
- **Extensions Build**: `packages/<name>/dist/<name>/index.js`
- **Skills**: `packages/<name>/SKILL.md` (or `packages/<name>/<sub-skill>/SKILL.md`)
- **package.json**: Set `"pi": { "extensions": ["extensions"] }` and `"main": "dist/<name>/index.js"`

### Skill Rename / Package Follow-through
When changing a skill name, command, or directory:
- Update `SKILL.md`, package.json, mindsets.json, shell integration, installers, docs, changesets

### Local Verification Before Done
- `npm test`
- `./bootstrap.sh --dry-run`
- `npm run changeset:status` when package contents changed

### Package Issue Closure Rule
- PR bodies: use `Refs #ISSUE`, not `Closes/Fixes` (close after npm publish)
- Add changeset: `npx changeset add`

### AI Commit Attribution
- Run `packages/norpiv/scripts/get-pi-model.sh` for deterministic `Assisted-by` trailers

### Retrospective & Workflow
- `.notrace/`: Owns retrospective artifacts
- `.workflow/`: Owns active task state
- Keep consumed metrics separate from optimization metrics (e.g., Headroom tokens saved)

### notrace Brand & Logo Guardrails
- Logo is finalized: Line Curve + notrace Name
- Favicon: Line Curve only
- Preserve SVG paths, fonts, colors exactly

## Quick Reference

- **Bootstrap**: `./bootstrap.sh` resets workspace
- **Hats**: `pi --nothing | --pm | --dev | --rpiv | --android | --meta`
- **Modifiers**: `--caveman | --rtk | --headroom | --leanctx | --notrace | --ponytail`
- **Combo**: `pi --tkmx` (all modifiers)
- **Reload shell**: `source dotfiles/shell_integration.sh`

## Config Sources
- **Global AGENTS**: `~/AGENTS.md` (from `config/AGENTS.md`)
- **Pi settings**: `~/.pi/agent/settings.json` (from `config/settings.json`)
- **Mindsets**: `~/.pi/agent/mindsets.json` (from `config/mindsets.json`)
- **Shell integration**: `dotfiles/shell_integration.sh`

## Obsidian Vault

This repo is Obsidian-native. Notes live at `~/RQZ/notes/` (the vault root). When reading, creating, or updating notes, use Obsidian CLI commands:
- Read: `obsidian note open <path>` or use `read` tool on the markdown file
- Create: write to `~/RQZ/notes/<area>/<note>.md` with Obsidian frontmatter
- Update: edit files in `~/RQZ/notes/` directly

Vault conventions:
- `ai/` — agent architecture, token efficiency, journal entries
- `references/` — durable reference docs
- `templates/` — note templates (Slide Source Note.md, etc.)
- Assets in `assets/` alongside their area

Use raw HTML `<svg>` tags for diagrams (Obsidian renders them). Avoid ` ```svg ` code blocks.
