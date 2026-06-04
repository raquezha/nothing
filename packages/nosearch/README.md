# Search Subagent

Delegates Brave Search and Firecrawl work to a fresh `pi` child process with an isolated context.

- `search_subagent` spawns a new `pi` process
- child sessions load only the relevant search skill
- the main session receives a compact result back
- `/search-subagent.smoke` runs a deterministic child-pi sanity check and reports: `Yes, my lord. I'm here to serve.`
