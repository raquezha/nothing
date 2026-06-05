#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node compile.js <input> <output.html> [title]");
  console.error("  <input>  path to .md, .json, .jsonl, .txt — or '-' for stdin");
  process.exit(1);
}

const inputArg  = args[0];
const outputPath = path.resolve(args[1]);
const customTitle = args[2] || null;

// ─── Read input ───────────────────────────────────────────────────────────────
let raw = "";
if (inputArg === "-") {
  raw = fs.readFileSync("/dev/stdin", "utf8");
} else {
  const inputPath = path.resolve(inputArg);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: file not found: ${inputPath}`);
    process.exit(1);
  }
  raw = fs.readFileSync(inputPath, "utf8");
}

// ─── Format detection ─────────────────────────────────────────────────────────
function detectFormat(content, filePath) {
  const ext = filePath && filePath !== "-" ? path.extname(filePath).toLowerCase() : "";

  if (ext === ".md") return "markdown";
  if (ext === ".jsonl") return "conversation";
  if (ext === ".json" || ext === ".jsonl") {
    try { const p = JSON.parse(content.trim()); if (Array.isArray(p) && p[0]?.role) return "conversation"; } catch {}
  }

  // Sniff content
  const trimmed = content.trim();

  // JSONL — each line is a JSON object with role
  const firstLine = trimmed.split("\n")[0].trim();
  try {
    const parsed = JSON.parse(firstLine);
    if (parsed.role) return "conversation";
  } catch {}

  // JSON array of messages
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed[0]?.role) return "conversation";
    if (parsed.messages && Array.isArray(parsed.messages)) return "conversation";
  } catch {}

  // Markdown heuristic — has # headers or - [ ] task lists
  if (/^#{1,6}\s+\S/m.test(trimmed) || /^[-*]\s+\[[ x]\]/m.test(trimmed)) return "markdown";

  return "text";
}

const format = detectFormat(raw, inputArg);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

// ─── Renderers ────────────────────────────────────────────────────────────────

// ── 1. Markdown ───────────────────────────────────────────────────────────────
function renderMarkdown(md) {
  const lines = md.split("\n");
  const html = [];
  const toc = [];
  let inCode = false, codeLang = "", codeLines = [];
  let inTable = false, tableRows = [];
  let inList = false, listOrdered = false;
  let taskCount = 0, taskDone = 0;
  let h1 = null;

  function flushList() {
    if (!inList) return;
    html.push(listOrdered ? "</ol>" : "</ul>");
    inList = false;
  }
  function flushTable() {
    if (!inTable) return;
    const [headerRow, , ...bodyRows] = tableRows;
    const headers = headerRow.split("|").map(c => c.trim()).filter(Boolean);
    let t = '<div class="table-wrap"><table><thead><tr>';
    headers.forEach(h => { t += `<th>${inlineMarkdown(esc(h))}</th>`; });
    t += "</tr></thead><tbody>";
    bodyRows.forEach(row => {
      const cells = row.split("|").map(c => c.trim()).filter(Boolean);
      t += "<tr>";
      cells.forEach(c => { t += `<td>${inlineMarkdown(esc(c))}</td>`; });
      t += "</tr>";
    });
    t += "</tbody></table></div>";
    html.push(t);
    inTable = false;
    tableRows = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code fence
    if (line.trim().startsWith("```")) {
      flushList(); flushTable();
      if (inCode) {
        const escaped = codeLines.join("\n").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        html.push(`<div class="code-wrap"><div class="code-header"><span class="code-lang">${esc(codeLang)||"code"}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><pre><code>${escaped}</code></pre></div>`);
        inCode = false; codeLines = [];
      } else {
        inCode = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }

    // Table
    if (line.includes("|")) {
      flushList();
      inTable = true;
      tableRows.push(line);
      continue;
    }
    if (inTable && !line.includes("|")) { flushTable(); }

    // Blank line
    if (line.trim() === "") { flushList(); flushTable(); html.push(""); continue; }

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      flushList(); flushTable();
      const level = hMatch[1].length;
      const text = hMatch[2].trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g,"");
      if (level === 1 && !h1) h1 = text;
      if (level <= 3) toc.push({ level, text, id });
      html.push(`<h${level} id="${id}">${inlineMarkdown(esc(text))}</h${level}>`);
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushList();
      html.push(`<blockquote>${inlineMarkdown(esc(line.slice(2)))}</blockquote>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushList(); html.push("<hr>"); continue;
    }

    // Task list item
    const taskMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (taskMatch) {
      flushList();
      const done = taskMatch[2].toLowerCase() === "x";
      const text = taskMatch[3];
      const slug = `task-${taskCount++}`;
      if (done) taskDone++;
      html.push(`<div class="task-item${done?" done":""}" id="${slug}"><button class="task-check" onclick="toggleTask('${slug}',this)" aria-label="toggle task">${done?'<svg viewBox="0 0 12 12"><polyline points="1,6 4,10 11,2" stroke="currentColor" stroke-width="2" fill="none"/></svg>':''}</button><span class="task-text">${inlineMarkdown(esc(text))}</span></div>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inList || !listOrdered) { if (inList) flushList(); html.push("<ol>"); inList = true; listOrdered = true; }
      html.push(`<li>${inlineMarkdown(esc(olMatch[2]))}</li>`);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listOrdered) { if (inList) flushList(); html.push("<ul>"); inList = true; listOrdered = false; }
      html.push(`<li>${inlineMarkdown(esc(ulMatch[2]))}</li>`);
      continue;
    }

    flushList();
    html.push(`<p>${inlineMarkdown(esc(line))}</p>`);
  }

  flushList(); flushTable();

  const tocHtml = toc.length > 2 ? `
    <nav class="toc" aria-label="Table of contents">
      <div class="toc-title">Contents</div>
      <ul>${toc.map(t=>`<li class="toc-h${t.level}"><a href="#${t.id}">${esc(t.text)}</a></li>`).join("")}</ul>
    </nav>` : "";

  const progressHtml = taskCount > 0 ? `
    <div class="progress-bar-wrap">
      <div class="progress-label"><span>${taskDone} / ${taskCount} tasks</span><span>${Math.round(taskDone/taskCount*100)}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.round(taskDone/taskCount*100)}%" id="progress-fill"></div></div>
    </div>` : "";

  return { body: tocHtml + progressHtml + html.join("\n"), title: h1, taskCount, taskDone };
}

// ── 2. Conversation ───────────────────────────────────────────────────────────
function renderConversation(raw) {
  let messages = [];
  const trimmed = raw.trim();

  // Try JSON array or {messages:[]}
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) messages = parsed;
    else if (parsed.messages) messages = parsed.messages;
  } catch {
    // Try JSONL
    for (const line of trimmed.split("\n")) {
      const l = line.trim();
      if (!l) continue;
      try { messages.push(JSON.parse(l)); } catch {}
    }
  }

  if (!messages.length) return null;

  function renderContent(content) {
    if (typeof content === "string") return `<p>${esc(content)}</p>`;
    if (!Array.isArray(content)) return `<pre>${esc(JSON.stringify(content,null,2))}</pre>`;
    return content.map(block => {
      if (block.type === "text") return `<p>${esc(block.text)}</p>`;
      if (block.type === "thinking") return `<details class="thinking-block"><summary>Thinking</summary><p>${esc(block.thinking)}</p></details>`;
      if (block.type === "toolCall") return `<details class="tool-block"><summary>🔧 ${esc(block.name)}</summary><pre>${esc(JSON.stringify(block.arguments,null,2))}</pre></details>`;
      if (block.type === "image") return `<p class="image-block">[image: ${esc(block.mimeType||"unknown")}]</p>`;
      return `<pre>${esc(JSON.stringify(block,null,2))}</pre>`;
    }).join("");
  }

  const bubbles = messages.map((msg, i) => {
    const role = msg.role || "unknown";
    const cls = role === "user" ? "bubble-user" : role === "assistant" ? "bubble-assistant" : "bubble-system";
    const label = role === "user" ? "You" : role === "assistant" ? "Assistant" : role;
    const content = renderContent(msg.content);
    return `<div class="bubble ${cls}"><div class="bubble-label">${esc(label)}</div><div class="bubble-body">${content}</div></div>`;
  }).join("\n");

  return { body: `<div class="conversation">${bubbles}</div>`, title: "Conversation" };
}

// ── 3. Plain text ─────────────────────────────────────────────────────────────
function renderText(text) {
  const escaped = esc(text);
  return { body: `<div class="text-card"><pre class="text-pre">${escaped}</pre></div>`, title: "Document" };
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────
let result;
if (format === "markdown") {
  result = renderMarkdown(raw);
} else if (format === "conversation") {
  result = renderConversation(raw);
  if (!result) result = renderText(raw);
} else {
  result = renderText(raw);
}

const pageTitle = customTitle || result.title || path.basename(inputArg, path.extname(inputArg)) || "nohtml";

// ─── HTML shell ───────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(pageTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg:        #0b0a15;
      --bg-panel:  rgba(18,17,32,0.80);
      --bg-card:   rgba(28,27,48,0.55);
      --border:    rgba(255,255,255,0.08);
      --border-hi: rgba(255,255,255,0.15);
      --text:      #e2e2ec;
      --muted:     #9fa0b0;
      --accent:    #8b5cf6;
      --accent2:   #6366f1;
      --success:   #10b981;
      --user-bg:   rgba(99,102,241,0.12);
      --user-bd:   rgba(99,102,241,0.3);
      --asst-bg:   rgba(16,185,129,0.08);
      --asst-bd:   rgba(16,185,129,0.25);
      --sys-bg:    rgba(139,92,246,0.08);
      --sys-bd:    rgba(139,92,246,0.25);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Outfit', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.65;
      padding: 2rem 1rem 4rem;
      background-image:
        radial-gradient(circle at 12% 10%, rgba(99,102,241,0.13) 0%, transparent 42%),
        radial-gradient(circle at 88% 90%, rgba(139,92,246,0.10) 0%, transparent 42%);
      background-attachment: fixed;
    }

    /* Layout */
    .wrap { max-width: 820px; margin: 0 auto; }
    .page-header {
      display: flex; align-items: center; gap: 0.75rem;
      margin-bottom: 2.5rem; padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border);
    }
    .page-header h1 {
      font-size: 1.9rem; font-weight: 700;
      background: linear-gradient(135deg, #c084fc, #6366f1);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .page-badge {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em;
      background: rgba(139,92,246,0.15); color: #c084fc;
      padding: 0.2rem 0.55rem; border-radius: 4px;
      border: 1px solid rgba(167,139,250,0.25);
    }

    /* Markdown content */
    h1,h2,h3,h4,h5,h6 { font-weight: 600; margin: 1.75rem 0 0.75rem; line-height: 1.3; }
    h1 { font-size: 2rem; background: linear-gradient(135deg,#c084fc,#6366f1); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    h2 { font-size: 1.45rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
    h3 { font-size: 1.2rem; color: #c084fc; }
    h4,h5,h6 { font-size: 1rem; color: var(--muted); }
    p  { margin: 0.9rem 0; color: var(--muted); }
    a  { color: #818cf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    strong { color: var(--text); }
    em { color: #c084fc; font-style: italic; }
    s  { color: var(--muted); }
    hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
    blockquote {
      border-left: 3px solid var(--accent); margin: 1rem 0;
      padding: 0.75rem 1.25rem; background: var(--bg-card);
      border-radius: 0 8px 8px 0; color: var(--muted);
    }
    ul,ol { padding-left: 1.6rem; margin: 0.75rem 0; }
    li { margin: 0.35rem 0; color: var(--muted); }
    code {
      font-family: 'Source Code Pro', monospace; font-size: 0.875em;
      background: rgba(139,92,246,0.15); color: #c084fc;
      padding: 0.15em 0.4em; border-radius: 4px;
    }

    /* Code blocks */
    .code-wrap { background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 12px; margin: 1.25rem 0; overflow: hidden; }
    .code-header { display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 1rem; background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border); }
    .code-lang { font-family: 'Source Code Pro',monospace; font-size: 0.75rem; color: var(--muted); }
    pre { padding: 1.1rem 1.25rem; overflow-x: auto; margin: 0; }
    pre code { background: none; padding: 0; color: var(--text); font-size: 0.875rem; }
    .copy-btn {
      background: transparent; border: 1px solid var(--border); color: var(--muted);
      padding: 0.2rem 0.7rem; border-radius: 6px; cursor: pointer; font-size: 0.72rem;
      font-family: 'Outfit',sans-serif; transition: all 0.2s;
    }
    .copy-btn:hover { border-color: var(--accent); color: #fff; }

    /* Tables */
    .table-wrap { overflow-x: auto; margin: 1.25rem 0; }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    th { background: rgba(139,92,246,0.1); color: var(--text); font-weight: 600; padding: 0.65rem 1rem; text-align: left; border-bottom: 1px solid var(--border); }
    td { padding: 0.6rem 1rem; border-bottom: 1px solid var(--border); color: var(--muted); }
    tr:hover td { background: rgba(255,255,255,0.02); }

    /* Task list */
    .task-item {
      display: flex; align-items: flex-start; gap: 0.85rem;
      background: var(--bg-card); border: 1px solid var(--border);
      padding: 0.85rem 1.1rem; border-radius: 10px; margin: 0.5rem 0;
      transition: border-color 0.2s;
    }
    .task-item:hover { border-color: var(--border-hi); }
    .task-check {
      flex-shrink: 0; width: 20px; height: 20px; margin-top: 2px;
      border: 2px solid var(--border); border-radius: 5px;
      background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; color: #fff;
    }
    .task-check svg { width: 12px; height: 12px; display: none; }
    .task-item.done .task-check { background: var(--success); border-color: var(--success); }
    .task-item.done .task-check svg { display: block; }
    .task-item.done .task-text { text-decoration: line-through; color: var(--muted); }
    .task-text { color: var(--text); }

    /* Progress */
    .progress-bar-wrap { margin: 1.5rem 0 2rem; }
    .progress-label { display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--muted); margin-bottom: 0.5rem; }
    .progress-track { height: 6px; background: rgba(255,255,255,0.07); border-radius: 99px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg,#6366f1,#8b5cf6); border-radius: 99px; transition: width 0.4s ease; }

    /* TOC */
    .toc { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1.1rem 1.4rem; margin: 1.5rem 0 2rem; }
    .toc-title { font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); margin-bottom: 0.75rem; }
    .toc ul { list-style: none; padding: 0; margin: 0; }
    .toc li { margin: 0.3rem 0; }
    .toc a { color: var(--muted); font-size: 0.9rem; transition: color 0.15s; }
    .toc a:hover { color: var(--text); text-decoration: none; }
    .toc-h2 { padding-left: 0; }
    .toc-h3 { padding-left: 1rem; }
    .toc-h4 { padding-left: 2rem; }

    /* Conversation */
    .conversation { display: flex; flex-direction: column; gap: 1rem; }
    .bubble { border-radius: 12px; border: 1px solid var(--border); overflow: hidden; }
    .bubble-user    { background: var(--user-bg); border-color: var(--user-bd); }
    .bubble-assistant { background: var(--asst-bg); border-color: var(--asst-bd); }
    .bubble-system  { background: var(--sys-bg);  border-color: var(--sys-bd); }
    .bubble-label {
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
      padding: 0.45rem 1rem; border-bottom: 1px solid var(--border);
    }
    .bubble-user     .bubble-label { color: #818cf8; }
    .bubble-assistant .bubble-label { color: #34d399; }
    .bubble-system   .bubble-label { color: #c084fc; }
    .bubble-body { padding: 0.9rem 1.1rem; }
    .bubble-body p { color: var(--text); margin: 0.4rem 0; }
    .thinking-block, .tool-block { margin: 0.5rem 0; }
    .thinking-block summary, .tool-block summary {
      cursor: pointer; font-size: 0.82rem; color: var(--muted);
      padding: 0.35rem 0.6rem; background: rgba(255,255,255,0.03);
      border-radius: 6px; border: 1px solid var(--border); list-style: none;
    }
    .thinking-block summary:hover, .tool-block summary:hover { color: var(--text); }
    .thinking-block p, .tool-block pre { margin-top: 0.5rem; padding: 0.75rem 1rem; background: rgba(0,0,0,0.2); border-radius: 8px; font-size: 0.85rem; }

    /* Plain text */
    .text-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .text-pre { padding: 1.5rem; font-family: 'Source Code Pro',monospace; font-size: 0.875rem; color: var(--text); white-space: pre-wrap; word-break: break-word; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="page-header">
      <h1>${esc(pageTitle)}</h1>
      <span class="page-badge">${esc(format)}</span>
    </header>
    <main>
      ${result.body}
    </main>
  </div>

  <script>
    // Copy code
    function copyCode(btn) {
      const code = btn.closest('.code-wrap').querySelector('code').innerText;
      navigator.clipboard.writeText(code).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied ✓';
        btn.style.color = '#10b981';
        setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1500);
      });
    }

    // Task toggle with localStorage persistence
    function toggleTask(id, btn) {
      const item = document.getElementById(id);
      const done = item.classList.toggle('done');
      localStorage.setItem('nohtml_' + id, done ? '1' : '0');
      updateProgress();
    }

    function updateProgress() {
      const all   = document.querySelectorAll('.task-item');
      const doneN = document.querySelectorAll('.task-item.done').length;
      const fill  = document.getElementById('progress-fill');
      const label = document.querySelector('.progress-label');
      if (!fill || !all.length) return;
      const pct = Math.round(doneN / all.length * 100);
      fill.style.width = pct + '%';
      if (label) {
        label.children[0].textContent = doneN + ' / ' + all.length + ' tasks';
        label.children[1].textContent = pct + '%';
      }
    }

    // Restore task states
    document.querySelectorAll('.task-item').forEach(item => {
      const stored = localStorage.getItem('nohtml_' + item.id);
      if (stored === '1') item.classList.add('done');
      else if (stored === '0') item.classList.remove('done');
    });
    updateProgress();
  </script>
</body>
</html>`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, "utf8");
console.log(`✓ nohtml → ${outputPath}  [format: ${format}]`);
