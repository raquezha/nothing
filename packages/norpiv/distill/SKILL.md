---
name: distill
description: >
  Distill the current conversation into a clean, durable Obsidian-ready markdown note.
  Triggered by: /distill, "distill this", "save the useful parts", "save this as a note",
  "turn this into a note", "capture this", "make this reusable", "summarize this for later".
  Use when the user wants to preserve the useful thinking from a conversation without
  turning it into a PRD, RPIV task, or implementation plan. Output is a single markdown
  file written to the configured Obsidian vault path.
---

# Skill: distill

## Purpose

Convert the current conversation into one clean, Obsidian-ready markdown note.

Not a workflow. Not a summary transcript. Not a PRD. Not an RPIV task.

A note that lets future-you rehydrate this thinking without rereading the whole conversation.

---

## Trigger phrases

Activate this skill when the user says any of:

- `/distill`
- `distill this`
- `save the useful parts`
- `save this as a note`
- `turn this into a note`
- `capture this`
- `make this reusable`
- `park this`
- `summarize this for obsidian`
- `save this before it disappears`

Do NOT wait for the user to say `/distill` explicitly. If they say any of the phrases above in any form, activate.

---

## Behavior rules

1. **Do not ask clarifying questions before producing the note.** Read the conversation and produce the note immediately.
2. **Do not create a PRD** unless the user explicitly requests one.
3. **Do not create an RPIV task** unless the user explicitly requests one.
4. **Do not over-structure weak ideas.** If the conversation was low-value, produce a minimal note and say so honestly.
5. **Infer the note shape from the conversation type.** Do not ask the user to choose.
6. **Always include a title and one-line summary** at the top.
7. **Always include a resume prompt** — a single question or prompt that lets future-you continue without rereading.
8. **Prefer one sharp note over a comprehensive transcript summary.** Preserve the *why this mattered*, not what was said.

---

## Note shapes (inferred, not chosen by user)

| Conversation type | Note shape |
|---|---|
| Idea or app concept | Concept note |
| Research or investigation | Research brief |
| Decision or tradeoff | Decision note |
| Debugging or learning | Learning note |
| Workflow or system design | Design note |
| Mixed or unclear | General distilled note |

---

## Output format

Produce a single markdown file.

### Default template

```md
---
distilled: {{YYYY-MM-DD}}
type: {{inferred: concept | research | decision | learning | design | note}}
tags: [{{inferred tags, 2-4 max}}]
---

# {{sharp, specific title — not generic}}

> {{one-line summary of what this conversation was about and why it mattered}}

## Why this mattered

{{1-3 sentences. Why did this conversation happen? What triggered the question?}}

## Core insight

{{The main realization. Not a summary of everything said. One clear insight.
If there was no clear insight, say so.}}

## Useful points

- {{point}}
- {{point}}
- {{point}}

## Open questions

{{Only include if there are genuine unresolved questions. Omit section if none.}}

- {{question}}

## Possible next move

{{Optional. Only include if there is a natural, obvious next action.
Do NOT invent tasks. Do NOT suggest starting RPIV unless the user is clearly ready.
If nothing is obvious, omit this section entirely.}}

## Promotion signal

{{Optional. Only include if the idea seems ready for real work.
Example: "This is ready for RPIV if: you know the first useful version, you can describe success, and you actually want to build this now."
If not ready, omit entirely. Do not fabricate readiness.}}

## Resume prompt

> {{A single question or prompt. When future-you opens this note, this is what Pi should ask first.
Example: "Do you still want to build this, and if so what's the smallest useful version?"
Example: "What's still unclear about the architecture before you commit?"}}
```

### Minimal template (low-value conversations)

If the conversation produced little of value, produce this instead and say so:

```md
---
distilled: {{YYYY-MM-DD}}
type: note
---

# {{title}}

> {{one-line summary}}

## Note

This conversation was exploratory and didn't produce a clear insight or decision.
Preserved in case it's useful later.

## Resume prompt

> {{question}}
```

---

## Output target

Write the note to the Obsidian vault. Create the `distilled/` directory if the parent vault/notes directory exists. Use this path resolution order:

1. `$OBSIDIAN_VAULT/distilled/` — if `$OBSIDIAN_VAULT` env var is set
2. `~/notes/distilled/` — fallback if `~/notes` exists
3. If neither parent exists, output the markdown to stdout and tell the user to copy it manually

Filename format: `YYYY-MM-DD-kebab-title.md`

Example: `2026-06-11-rpiv-vs-idea-research.md`

After writing, confirm to the user:

```
✓ Saved to: ~/notes/distilled/2026-06-11-rpiv-vs-idea-research.md
```

If writing fails, output the markdown to stdout so the user can copy it manually. Never silently fail.

---

## What this skill does NOT do

- Does not start RPIV
- Does not create a PRD
- Does not ask the user to classify their idea
- Does not produce a multi-section workflow artifact
- Does not require `WORK.md`
- Does not interact with `.workflow/` directory
- Does not sync to Jira, GitHub, or GitLab
- Does not run post-merge-prune
- Does not require any existing task or ticket

---

## Relationship to RPIV

```
conversation → /distill → Obsidian note    (pre-commitment, no task)
Obsidian note → RPIV                       (only when user is ready to commit)
```

`distill` feeds RPIV. RPIV does not absorb `distill`.

If a distilled note contains a **Promotion signal** section, the user can choose to run `/triage` manually on that idea later. `distill` never starts triage automatically.
