---
---

Implement single replaceable rolling checkpoint contract for Nochestra (`checkpoint.mjs`).

- Overwrites active state in place rather than appending or accumulating transcript turn history.
- Validates required fields (`subject`, `goal`, `decisions`, `constraints`, `openQuestions`, `rejectedOptions`, `currentRoute`, `suggestedNextRoute`).
- Rejects forbidden accumulation fields (`history`, `previousCheckpoints`, `messages`, `transcript`).
- Adds unit tests proving replacement semantics, schema isolation, and fact/question separation.
- Documents provisional rolling checkpoint contract in Nochestra README.

Refs #78
