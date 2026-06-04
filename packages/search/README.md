# search (Brave Search & Web Scraper Tools)

Core search automation skills and background subagent wrappers used to fetch live web documentation, stack overflows, and API specifications.

## 🛠 Skills Checklist

This package exposes the following search skills:

- **`brave-search`**: Execute web search queries directly via the Brave Search API. Automatically parses and ranks summary results.
- **`firecrawl`**: High-performance web scraper that converts any public HTML webpage or documentation site into clean, LLM-friendly Markdown.
- **`nosearch` (Extension)**: Spawn an isolated, detached child `pi` session in the background to conduct research, compile results, and return summaries without cluttering the main session's context window.

---

## 🚀 Usage

Load this toolkit dynamically by launching the agent with the PM, Dev, or RPIV flags:

```bash
pi --pm
# or
pi --rpiv
```

Or target specific skills in your prompt:
```text
/brave-search "typescript 5.5 release notes"
```

To scrape a documentation URL:
```text
/firecrawl https://nextjs.org/docs/app/building-your-application/routing
```
