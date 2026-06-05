---
name: nohtml
description: Convert any input into a premium, self-contained, interactive HTML page. Accepts markdown files, pi agent conversation transcripts (JSONL/JSON), plain text, or raw piped content. Auto-detects the input format and renders the most appropriate output.
---

# nohtml — Universal Input to HTML Compiler

Converts **any input** into a beautiful, self-contained, offline-ready HTML page.

## Supported Input Formats

| Format | Detection | Output Style |
|---|---|---|
| Markdown (`.md`) | File extension or `#`/`##` headers | Document with TOC, checkboxes, code blocks |
| Pi conversation transcript (`.jsonl`, JSON array with `role` fields) | JSON with `role: user/assistant` | Chat-style conversation view |
| Plain text / stdout dump | Everything else | Clean readable card layout |

## When to Use

- User wants to share or archive a conversation as a readable HTML page
- User wants to turn a `PLAN.md`, `README.md`, or any markdown into an interactive dashboard
- User wants to render raw text, logs, or agent output as a polished report
- User asks to "make this into HTML", "export this", "generate a page from..."

## Workflow

### 1. Identify the source

Accept input as:
- A file path (`.md`, `.jsonl`, `.json`, `.txt`, or any extension)
- Piped stdin content
- Raw text content passed as an argument

### 2. Detect format and render

Run the compiler:

```bash
node <skill-dir>/scripts/compile.js <input> <output.html> [title]
```

The compiler auto-detects the input type:
- **Markdown**: parses headers, task lists, code blocks, tables, inline formatting
- **Conversation JSON/JSONL**: renders a chat bubble timeline with user/assistant roles, tool calls collapsed
- **Plain text**: wraps in a clean readable card with monospace fallback

### 3. Report the output path

Tell the user the output file path as a clickable `file://` link.

## Output Contract

- Single `.html` file, fully self-contained (no external JS deps at runtime)
- Works offline (Google Fonts are the only optional external resource)
- Glassmorphism dark theme (Dracula-adjacent palette)
- Interactive: persistent checkbox states via `localStorage`, copy-to-clipboard on code blocks, smooth TOC scroll

## ⚠️ Agent Guardrail

Do NOT run this compiler during planning. Only invoke `compile.js` when the user explicitly requests HTML output. Logged incident 2026-06-05: agent pushed compile.js without user sign-off.
