---
---

Add a minimal Jira-to-triage proof contract for Nochestra without introducing a full worker runtime.

- Adds `packages/workflows/nochestra/jira-triage-proof.mjs`.
- Proves bounded handoff shape, Jira approval gating, and compact worker result validation.
- Keeps the #79 executor gap explicit instead of pretending dispatch already exists.

Refs #83
