---
"@raquezha/notrace": minor
---

Implement machine-global observability dashboard and Mistral-style timeline parser. 
- Storage migrated from `.notrace/` in the local working directory to a machine-wide `~/.notrace/` directory to prevent repository pollution and enable global insights.
- Dashboard updated with a new `Project` column for multi-repo tracking.
- Timeline parser overhauled to render LLM arrays, tool execution cards, and code blocks beautifully instead of raw JSON dumps.
