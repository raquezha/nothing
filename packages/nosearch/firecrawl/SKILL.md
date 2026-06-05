---
name: firecrawl
description: Scrape, map, and search the web with Firecrawl REST helpers. Use when you need page extraction, site discovery, or search results that should come back as markdown or links.
---

# Firecrawl

Use this skill when Firecrawl is the better fit than plain web search.

## When to use
- scrape a known URL into markdown
- map a site to discover crawlable URLs
- search the web and optionally scrape the results

## Workflow
1. Check `FIRECRAWL_API_TOKEN` is available in the current shell or `~/.pi-secrets/.env`.
2. When running inside pi, prefer the `search_subagent` tool so Firecrawl runs in a fresh child context.
3. For manual fallback, pick the smallest helper:
   - `./scrape.sh <url>`
   - `./map.sh <url>`
   - `./search.sh <query>`
4. Use `--json` when the raw API response is more useful than the friendly view.
5. Keep requests narrow; only add scrape/limit flags when needed.

## Rules
- Never print or hardcode the token.
- Use the repo-local scripts only; do not install the upstream package.
- Assume the model only needs the smallest useful output.
- Inside pi, use the `search_subagent` tool first so Firecrawl runs in a fresh child session.

## Validation
- Missing token fails fast.
- HTTP errors surface the Firecrawl response body.
- Successful calls return either markdown, links, or pretty JSON.

## Scripts
- `common.sh` — shared request helpers
- `scrape.sh` — scrape one URL
- `map.sh` — list discoverable URLs for a site
- `search.sh` — search Firecrawl and optionally scrape results

