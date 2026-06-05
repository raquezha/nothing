# nosearch (Integrated Brave Search, Firecrawl Scraper, & Isolated Subagents)

A unified search and web-scraping package for the Pi agent. It exposes direct search skills and wraps them in a detached, resource-isolated background worker to conduct web research without context window bloating.

## 🛠️ Components Checklist

1. **`brave-search`** (Skill)
   * Direct integration with the Brave Search API.
   * Query the web, extract page titles, snippets, and deep URLs.
2. **`firecrawl`** (Skill)
   * Converts any public HTML webpage or documentation URL into clean, structured Markdown.
3. **`nosearch`** (Extension)
   * Spawns a separate, lightweight `pi` subagent child process in the background.
   * Delegates the search/scraping queries to the child process to compile findings.
   * Feeds back a compact summary to the parent agent, keeping your main context window clean.

---

## 🚀 Commands & Usage

### Direct Scrapes & Searches
```text
/brave-search "react 19 concurrent features documentation"
/firecrawl https://nextjs.org/docs/app/building-your-application/routing
```

### Subagent Delegation Smoke Test
Runs a sanity check to verify subagent fork safety:
```text
/search-subagent.smoke
```
*(Response: "Yes, my lord. I'm here to serve.")*
