# nosearch

Integrated Brave Search and Firecrawl subagent wrapper extension for the Pi Coding Agent. Spawns an isolated child `pi` process to delegate web search, site mapping, and page scraping — keeping the main agent session clean and the search context fully sandboxed.

## Tools registered

### `search_subagent`

Spawns a fresh pi child process and delegates search work to it.

| Parameter | Type | Description |
|---|---|---|
| `backend` | `brave` \| `firecrawl` | Which search backend to use |
| `mode` | `search` \| `scrape` \| `map` | Firecrawl mode (ignored for Brave) |
| `query` | `string` | Search query (required for `brave` and `firecrawl search`) |
| `url` | `string` | Target URL (required for `firecrawl scrape` and `map`) |
| `limit` | `integer` | Optional result limit |

## Commands

- `/nosearch.smoke` — Runs a deterministic child-pi smoke test to verify subagent wiring

## Skills bundled

The `brave-search/` and `firecrawl/` skill directories live inside this package and are resolved automatically at runtime — no hardcoded paths.

## Usage

```bash
# Load directly from this checkout
pi --extension ./packages/nosearch

# Via nothing mindsets (dev, rpiv, pm, meta)
pi --rpiv
```

## Skills-only handoff with `npx skills add`

Best for installing only the bundled search skills:

```bash
npx -y skills add raquezha/nothing --full-depth -g -a pi \
  -s brave-search firecrawl \
  -y
```

## NPM

```bash
npm install -g @raquezha/nosearch
```

Install the bundled skills for your agent runtime:

```bash
# Pi default: ~/.pi/agent/skills/{brave-search,firecrawl}
nosearch-install

# Other adapters
nosearch-install --target claude
nosearch-install --target codex
nosearch-install --target all
```

Targets:
- `pi` links skills into `~/.pi/agent/skills`.
- `claude` links skills into `~/.claude/skills`.
- `codex` installs the skill docs under `~/.codex/skills/nosearch` and writes an `AGENTS.md` adapter because Codex-style environments do not universally auto-load `SKILL.md` bundles.
