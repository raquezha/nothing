---
"@raquezha/noagy": patch
"@raquezha/noleaks": patch
"@raquezha/notrace": patch
"@raquezha/nofooter": patch
"@raquezha/nosearch": patch
---

Fix skill conflicts by auto-expanding skill collections in shell integration.
Standardize extension structure by moving entrypoints to conventional extensions/ directories. This allows Pi to auto-discover them and display clean labels (e.g., "noagy") without file extensions in the UI.
