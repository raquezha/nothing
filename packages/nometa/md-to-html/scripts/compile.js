#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Usage: node compile.js source.md output.html [title]
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node compile.js <source.md> <output.html> [title]");
  process.exit(1);
}

const sourcePath = path.resolve(args[0]);
const outputPath = path.resolve(args[1]);
const pageTitle = args[2] || "Interactive Dashboard";

if (!fs.existsSync(sourcePath)) {
  console.error(`Error: Source file not found at ${sourcePath}`);
  process.exit(1);
}

const mdContent = fs.readFileSync(sourcePath, 'utf8');

// Basic Markdown parser
function parseMarkdown(md) {
  const lines = md.split('\n');
  let html = [];
  let inList = false;
  let inCode = false;
  let codeLang = '';
  let codeContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block
    if (line.trim().startsWith('```')) {
      if (inCode) {
        inCode = false;
        const escapedCode = codeContent.join('\n')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        html.push(`<div class="code-wrapper">
          <div class="code-header">
            <span>${codeLang || 'code'}</span>
            <button class="copy-btn" onclick="copyCode(this)">Copy</button>
          </div>
          <pre><code>${escapedCode}</code></pre>
        </div>`);
        codeContent = [];
      } else {
        inCode = true;
        codeLang = line.trim().substring(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeContent.push(line);
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      const text = line.substring(2).trim();
      html.push(`<h1>${text}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      const text = line.substring(3).trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      html.push(`<h2 id="${id}">${text}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      const text = line.substring(4).trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      html.push(`<h3 id="${id}">${text}</h3>`);
      continue;
    }

    // Task list / Checklists
    const taskMatch = line.trim().match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      if (inList) { html.push('</ul>'); inList = false; }
      const checked = taskMatch[1].toLowerCase() === 'x';
      const text = taskMatch[2].trim();
      const taskSlug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30);
      const taskId = `task-${taskSlug}`;
      html.push(`
      <div class="task-item ${checked ? 'completed' : ''}" id="${taskId}">
        <div class="task-checkbox" onclick="toggleTask('${taskSlug}', this); event.stopPropagation();"></div>
        <div class="task-content">
          <div class="task-text">${text}</div>
        </div>
      </div>`);
      continue;
    }

    // Standard list item
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      const text = line.trim().substring(2).trim();
      html.push(`<li>${text}</li>`);
      continue;
    }

    if (line.trim() === '') {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      continue;
    }

    // Paragraph
    if (!inList && !inCode) {
      html.push(`<p>${line.trim()}</p>`);
    }
  }

  if (inList) html.push('</ul>');
  return html.join('\n');
}

const parsedHtmlContent = parseMarkdown(mdContent);

// Build full template complying with WHATWG HTML Living Standard
const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Source+Code+Pro:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0a15;
      --bg-panel: rgba(18, 17, 32, 0.75);
      --bg-card: rgba(28, 27, 48, 0.5);
      --border: rgba(255, 255, 255, 0.08);
      --text: #e2e2ec;
      --text-muted: #9fa0b0;
      --accent: #8b5cf6;
      --accent-gradient: linear-gradient(135deg, #c084fc, #6366f1);
      --success: #10b981;
    }
    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem 1rem;
      background-image: 
        radial-gradient(circle at 10% 10%, rgba(99, 102, 241, 0.12) 0%, transparent 40%),
        radial-gradient(circle at 90% 90%, rgba(139, 92, 246, 0.1) 0%, transparent 40%);
      background-attachment: fixed;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      padding: 2.5rem;
      border-radius: 24px;
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }
    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    h2 {
      font-size: 1.75rem;
      margin-top: 2rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.5rem;
    }
    h3 {
      font-size: 1.35rem;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
    }
    p {
      margin-bottom: 1.25rem;
      color: var(--text-muted);
    }
    ul, ol {
      margin-bottom: 1.25rem;
      padding-left: 1.5rem;
    }
    li {
      margin-bottom: 0.5rem;
    }
    .code-wrapper {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 1.5rem;
      overflow: hidden;
    }
    .code-header {
      background: rgba(255, 255, 255, 0.03);
      padding: 0.5rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      font-size: 0.8rem;
      font-family: 'Source Code Pro', monospace;
    }
    pre {
      padding: 1rem;
      overflow-x: auto;
      margin: 0;
    }
    code {
      font-family: 'Source Code Pro', monospace;
      font-size: 0.9rem;
    }
    .copy-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 0.25rem 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.75rem;
      transition: all 0.2s;
    }
    .copy-btn:hover {
      border-color: var(--accent);
      color: #fff;
    }
    .task-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      padding: 1rem;
      border-radius: 12px;
      margin-bottom: 0.75rem;
      transition: all 0.3s;
    }
    .task-checkbox {
      width: 20px;
      height: 20px;
      border: 2px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
      position: relative;
      transition: all 0.2s;
    }
    .task-item.completed .task-checkbox {
      background: var(--success);
      border-color: var(--success);
    }
    .task-item.completed .task-checkbox::after {
      content: '✓';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #fff;
      font-size: 0.75rem;
      font-weight: bold;
    }
    .task-item.completed .task-text {
      text-decoration: line-through;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <main class="container">
    ${parsedHtmlContent}
  </main>

  <script>
    function copyCode(btn) {
      const code = btn.closest('.code-wrapper').querySelector('code').innerText;
      navigator.clipboard.writeText(code).then(() => {
        const orig = btn.textContent;
        btn.textContent = "Copied! ✓";
        btn.style.color = "var(--success)";
        setTimeout(() => {
          btn.textContent = orig;
          btn.style.color = "";
        }, 1500);
      });
    }

    function toggleTask(slug, checkbox) {
      const item = checkbox.closest('.task-item');
      const completed = item.classList.toggle('completed');
      localStorage.setItem('task_status_' + slug, completed ? 'true' : 'false');
    }

    // Load checkbox states from LocalStorage on load
    document.querySelectorAll('.task-item').forEach(item => {
      const slug = item.id.replace('task-', '');
      const stored = localStorage.getItem('task_status_' + slug);
      if (stored === 'true') {
        item.classList.add('completed');
      } else if (stored === 'false') {
        item.classList.remove('completed');
      }
    });
  </script>
</body>
</html>`;

fs.writeFileSync(outputPath, template, 'utf8');
console.log(`Successfully compiled markdown to HTML dashboard at ${outputPath} 🎉`);
