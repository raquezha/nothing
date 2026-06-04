---
name: brave-search
description: Search the web using Brave Search API. Use this skill when you need to find information, documentation, or answers that are not in the local codebase.
---

# Brave Search Skill

This skill provides web search capabilities using the Brave Search API.

## Prerequisites

- [Brave Search API Key](https://api.search.brave.com/app/dashboard)
- `BRAVE_SEARCH_API_KEY` available in the current shell or `~/.pi-secrets/.env`
- `jq` installed for JSON processing

## Usage

When running inside pi, prefer the `search_subagent` tool so Brave Search happens in a fresh child context.

The agent can also use the following commands to search the web or read specific pages for manual fallback.

### Search Web
```bash
./search.sh "your search query"
```

### Search and Output as Markdown Table
```bash
./search.sh "your search query" --table
```

### Read a Specific URL
```bash
./read.sh "https://example.com"
```

### Search and Get Summaries
```bash
./search.sh "your search query" --summarize
```

## Implementation

The skill uses helper scripts to interact with the API.
Inside pi, the `search_subagent` tool should run Brave Search in a fresh child session first.
The scripts remain the manual fallback.
