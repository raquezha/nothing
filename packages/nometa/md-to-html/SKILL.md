---
name: md-to-html
description: Compile any markdown (.md) document into a premium, interactive, and self-contained HTML file. Use when the user requests generating a web dashboard, an interactive plan, a readable documentation page, or a formatted report from one or more markdown files.
---

# MD to HTML Compiler

This skill handles converting standard Markdown files (such as documentation, READMEs, plans, or problem briefs) into high-fidelity, interactive, and self-contained HTML files.

## Purpose
Enables turning static documentation or checklists into visually stunning, interactive web pages with responsive layout, persistent checkbox states, and copyable code blocks.

## When to Use
Use when:
- The user wants to convert a markdown file (e.g., `PLAN.md`, `README.md`, `PROBLEM.md`) into a formatted HTML page.
- You need to generate an interactive checklist/dashboard with progress tracking.
- You want to publish a polished, self-contained report or manual from markdown sources.

## Workflow

### 1. Read and Analyze Source Markdown
1. Load the source markdown file(s).
2. Scan the document structure:
   - Identify headers (`#`, `##`, `###`) to establish hierarchy and optionally generate a Table of Contents (TOC).
   - Locate task lists (`- [ ]`, `- [x]`) for interactive checkbox compilation.
   - Detect code blocks (with language identifiers) for syntax highlighting wrapper and copy-to-clipboard elements.

### 2. Map Markdown to Semantic HTML5
Translate the AST/tokens into corresponding semantic elements:
- `#` ➔ `<h1>` (exactly one per document for SEO best practices)
- `##` / `###` ➔ `<h2>` / `<h3>`
- Paragraphs ➔ `<p>`
- Code blocks ➔ `<pre><code>` with copy utility wrapper
- Task checklists ➔ `<div class="task-item">` with custom checkboxes
- Lists ➔ `<ul>` / `<ol>`
- Tables ➔ `<table>` with formatted alignment

### 3. Inject Styling & Theme System
Use vanilla CSS inside a `<style>` block to provide a state-of-the-art visual presentation:
- **Typography**: Import premium sans-serif (e.g., `Outfit`, `Inter`) and monospace fonts (e.g., `Source Code Pro`).
- **Colors**: Sleek dark theme using tailored variable sets (e.g., deep purples, emerald greens, slate borders).
- **Glassmorphism**: Subtle radial gradients and backdrops (`backdrop-filter`) for containers, tables, and sidebars.
- **Interactions**: Smooth hover effects and transitions.

### 4. Inject Interactive Features (JavaScript)
Embed minimal, vanilla JS for user convenience:
- **Clipboard Utility**: A copy-code button for each `<pre>` block.
- **TOC Navigation**: Smooth-scroll routing for header anchors.
- **Checklist Persistence**: Map checkbox toggles to `localStorage` key-value pairs so states persist across page reloads.
- **Progress Tracking**: If checklists are present, update overall completion indicators dynamically.

## Output Contract
Generate a single, self-contained `.html` file that operates completely offline without external JS dependencies (excluding Google Fonts or optional CDN icons).
