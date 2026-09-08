---
"@raquezha/nodesign": patch
"@raquezha/norpiv": patch
---

Add standalone auth login and status flows for nodesign, with credential source resolution from cwd .env, pi-secrets, OS keychain, and config-file fallback.

Connect norpiv planning preflight to nodesign as a package dependency, with documented npx fallback.
