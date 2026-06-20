export function escapeHtml(v: unknown): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  };
  return String(v ?? "").replace(/[&<>'"]/g, c => map[c]);
}

export function safeJsonForScript(v: any): string {
  const map: Record<string, string> = {
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029"
  };
  return JSON.stringify(v).replace(/[<>&\u2028\u2029]/g, c => map[c]);
}

function parseDate(value: string | number): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateCell(value: string | number): string {
  const date = parseDate(value);
  if (!date) return `<span>${escapeHtml(value)}</span>`;
  const day = date.toISOString().slice(0, 10);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `<div class="date-cell"><strong>${escapeHtml(day)}</strong><span>${escapeHtml(time)}</span></div>`;
}

function formatDateLong(value: string | number): string {
  const date = parseDate(value);
  if (!date) return escapeHtml(value);
  const day = date.toISOString().slice(0, 10);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${escapeHtml(day)} ${escapeHtml(time)}`;
}

function formatTime(value: string | number): string {
  const date = parseDate(value);
  if (!date) return escapeHtml(value);
  return escapeHtml(date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
}

function workflowDisplayName(workflow: string | null | undefined): string {
  switch (workflow) {
    case "norpiv":
      return "RPIV";
    case "research":
      return "Research";
    case "generic":
    default:
      return "Generic";
  }
}

function workflowClassName(workflow: string | null | undefined): string {
  switch (workflow) {
    case "norpiv":
      return "workflow-rpiv";
    case "research":
      return "workflow-research";
    case "generic":
    default:
      return "workflow-generic";
  }
}

function taskDisplay(taskish: any): string {
  const task = taskish?.task || taskish;
  const workflow = task?.workflow || taskish?.workflow || "generic";
  const taskId = task?.id ?? taskish?.taskId;
  if (taskId) {
    if (workflow === "research" && String(taskId).startsWith("branch:")) {
      return `Branch ${String(taskId).slice(7)}`;
    }
    return String(taskId);
  }
  if (workflow === "research") return "Open research";
  if (workflow === "generic") return "General session";
  return "No active task";
}

function resolveRepoName(data: any): string {
  const name = data?.repository?.name || data?.repositoryName || data?.repoName || "Repository";
  const branch = data?.repository?.branch;
  return branch ? `${name} @ ${branch}` : name;
}

function formatUsd(value: number | undefined): string {
  const num = Number(value || 0);
  if (num === 0) return "$0";
  return `$${num.toFixed(5)}`;
}

function formatTelemetryStatus(value: string | undefined): string {
  switch (value) {
    case "active": return "Active";
    case "loaded-disabled": return "Loaded disabled";
    case "loaded-inactive": return "Loaded inactive";
    case "absent": return "Absent";
    case "unknown":
    default:
      return "Unknown";
  }
}

function summarizeEventCount(data: any): number {
  return Array.isArray(data?.events)
    ? data.events.filter((ev: any) => ev?.type !== "session_start" && ev?.type !== "turn_start").length
    : 0;
}

function wordmarkSvg(className = "wordmark"): string {
  return `<svg class="${escapeHtml(className)}" viewBox="0 0 420 138" aria-label="notrace" role="img" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fadeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#E2754A"/>
        <stop offset="100%" stop-color="#EDE2D2"/>
      </linearGradient>
    </defs>
    <g id="trace-icon" transform="translate(1 -18) scale(0.93)">
      <path d="M6,50 C16,18 26,18 36,50 C46,82 54,82 60,50 C64,30 68,30 71,50"
        fill="none" stroke="url(#fadeGrad)" stroke-width="4" stroke-linecap="round"/>
      <line x1="74" y1="50" x2="79" y2="50" stroke="#D9C9B5" stroke-width="4" stroke-linecap="round" stroke-opacity="0.6"/>
      <circle cx="85" cy="50" r="2.2" fill="#D9C9B5" opacity="0.5"/>
      <circle cx="90" cy="50" r="1.4" fill="#EDE2D2" opacity="0.32"/>
      <circle cx="94" cy="50" r="0.9" fill="#EDE2D2" opacity="0.15"/>
    </g>
    <text x="0" y="114" fill="#ECE3DA" style="fill:#ECE3DA" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="96" font-weight="900" letter-spacing="-7">no</text>
    <text x="82" y="114" fill="#d88462" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="96" font-weight="900" letter-spacing="-7">trace</text>
  </svg>`;
}

function faviconHref(): string {
  const svg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img"><title>notrace logo mark</title><desc>A wave that smooths into a flat line, then fades into dots — color shifts from trace orange to no cream as it dissolves.</desc><defs><linearGradient id="fadeGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#E2754A"/><stop offset="100%" stop-color="#EDE2D2"/></linearGradient></defs><g id="trace-icon"><path d="M6,50 C16,18 26,18 36,50 C46,82 54,82 60,50 C64,30 68,30 71,50" fill="none" stroke="url(#fadeGrad)" stroke-width="4" stroke-linecap="round"/><line x1="74" y1="50" x2="79" y2="50" stroke="#D9C9B5" stroke-width="4" stroke-linecap="round" stroke-opacity="0.6"/><circle cx="85" cy="50" r="2.2" fill="#D9C9B5" opacity="0.5"/><circle cx="90" cy="50" r="1.4" fill="#EDE2D2" opacity="0.32"/><circle cx="94" cy="50" r="0.9" fill="#EDE2D2" opacity="0.15"/></g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function shell(title: string, body: string, script = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="icon" href="${faviconHref()}">
  <style>
    :root {
      --bg: #0c0b0a;
      --panel: rgba(255,255,255,0.04);
      --panel-strong: rgba(255,255,255,0.06);
      --text: #ece3da;
      --muted: rgba(236,227,218,0.68);
      --accent: #d88462;
      --accent-soft: rgba(216,132,98,0.12);
      --border: rgba(255,255,255,0.08);
      --shadow: 0 20px 50px rgba(0,0,0,0.45);
      --code: #090807;
      --err: #ef7f7f;
      --rpiv-fg: #f3be8a;
      --rpiv-bg: rgba(243,190,138,0.12);
      --rpiv-border: rgba(243,190,138,0.26);
      --research-fg: #8ec5ff;
      --research-bg: rgba(142,197,255,0.12);
      --research-border: rgba(142,197,255,0.24);
      --generic-fg: #b9b4ae;
      --generic-bg: rgba(185,180,174,0.12);
      --generic-border: rgba(185,180,174,0.2);
    }
    * { box-sizing: border-box; }
    html { color-scheme: dark; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      background-image: radial-gradient(circle at 50% -10%, rgba(216,132,98,0.14), transparent 45%);
      background-attachment: fixed;
    }
    a { color: inherit; }
    .container { max-width: 1120px; margin: 0 auto; padding: 32px 20px 64px; }
    .hero, .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }
    .hero { padding: 28px; margin-bottom: 24px; }
    .hero-top {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: start;
    }
    .brand { margin-bottom: 10px; }
    .brand-link {
      display: inline-flex;
      align-items: flex-start;
      text-decoration: none;
    }
    .wordmark {
      width: 340px;
      height: 112px;
      display: block;
      overflow: visible;
    }
    .subtitle { margin: 10px 0 0; color: var(--muted); }
    .session-subtitle {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .session-id-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-width: 100%;
      padding: 6px 8px 6px 10px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: rgba(0,0,0,0.18);
      color: var(--text);
      font-family: "SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas, monospace;
      font-size: 0.78rem;
      word-break: break-all;
    }
    .copy-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 999px;
      background: rgba(255,255,255,0.04);
      color: var(--muted);
      cursor: pointer;
      transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
    }
    .copy-btn:hover, .copy-btn.copied {
      color: var(--text);
      border-color: rgba(216,132,98,0.45);
      background: var(--accent-soft);
    }
    .meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
      margin-top: 16px;
    }
    .pill, .workflow-pill, .sort-btn, .export-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: rgba(255,255,255,0.03);
      color: var(--muted);
      font-size: 0.86rem;
      font-weight: 600;
    }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 16px; margin: 24px 0; }
    .metric-card {
      background: var(--panel-strong);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 18px;
    }
    .metric-card small { display: block; color: var(--accent); text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.72rem; font-weight: 700; }
    .metric-card strong { display: block; margin-top: 8px; font-size: 1.55rem; }
    .panel { padding: 0; overflow: hidden; }
    .section-title { margin: 0; padding: 20px 22px; border-bottom: 1px solid var(--border); font-size: 1rem; }
    .empty { padding: 32px 22px; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 14px 18px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
    th { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; }
    .num-cell { text-align: right; }
    tr:last-child td { border-bottom: 0; }
    .col-index { width: 64px; }
    .sortable-head { padding: 10px 18px; }
    .sort-btn {
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      font: inherit;
      text-transform: inherit;
      letter-spacing: inherit;
      cursor: pointer;
    }
    .sort-label { color: inherit; }
    .sort-state { color: var(--accent); font-size: 0.9rem; min-width: 16px; text-align: left; line-height: 1; }
    .index-cell { color: var(--muted); font-variant-numeric: tabular-nums; }
    .session-link { text-decoration: none; }
    .session-link strong { display: block; }
    .session-sub { display: block; margin-top: 2px; color: var(--muted); font-size: 0.8rem; }
    .workflow-pill { padding: 6px 10px; font-size: 0.78rem; }
    .workflow-rpiv { color: var(--rpiv-fg); background: var(--rpiv-bg); border-color: var(--rpiv-border); }
    .workflow-research { color: var(--research-fg); background: var(--research-bg); border-color: var(--research-border); }
    .workflow-generic { color: var(--generic-fg); background: var(--generic-bg); border-color: var(--generic-border); }
    .date-cell { display: grid; gap: 2px; }
    .date-cell strong { font-size: 0.92rem; }
    .date-cell span { color: var(--muted); font-size: 0.82rem; }
    .timeline { display: grid; gap: 14px; }
    .event {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 18px;
      overflow: hidden;
    }
    .event summary {
      list-style: none;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: center;
      padding: 16px 18px;
    }
    .event summary::-webkit-details-marker { display: none; }
    .event summary:hover { background: rgba(255,255,255,0.02); }
    .event-main { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.03);
    }
    .badge-llm { color: var(--accent); background: var(--accent-soft); border-color: rgba(216,132,98,0.24); }
    .badge-tool { color: #8ec5ff; background: rgba(142,197,255,0.1); border-color: rgba(142,197,255,0.22); }
    .badge-system { color: var(--muted); }
    .badge-error { color: var(--err); background: rgba(239,127,127,0.12); border-color: rgba(239,127,127,0.24); }
    .event-title { font-weight: 700; }
    .event-time { color: var(--muted); font-size: 0.9rem; white-space: nowrap; }
    .event-body { padding: 0 18px 18px; }
    .stack { display: grid; gap: 12px; }
    .block {
      background: rgba(0,0,0,0.18);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
    }
    .block h4 {
      margin: 0;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      color: var(--muted);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    pre {
      margin: 0;
      padding: 14px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: "SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas, monospace;
      font-size: 0.84rem;
      background: var(--code);
    }
    .msg { border-bottom: 1px solid var(--border); }
    .msg:last-child { border-bottom: 0; }
    .msg-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      background: rgba(255,255,255,0.02);
    }
    .msg-role { font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
    .msg.user .msg-role { color: #8ec5ff; }
    .msg.assistant .msg-role { color: var(--accent); }
    .msg-content { padding: 14px; }
    .chat-text {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .chat-text:last-child { margin-bottom: 0; }
    .chat-tool-use {
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .chat-tool-use:last-child { margin-bottom: 0; }
    .chat-tool-header {
      background: rgba(255,255,255,0.04);
      padding: 8px 12px;
      font-size: 0.8rem;
      font-family: "SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas, monospace;
      color: #8ec5ff;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .chat-tool-body {
      padding: 12px;
      margin: 0;
      background: transparent;
      border: none;
      max-height: 400px;
      overflow-y: auto;
    }
    .footer-note {
      margin-top: 22px;
      color: var(--muted);
      text-align: center;
      padding: 10px 0 0;
      font-family: inherit;
    }
    .footer-note.minimal {
      font-size: 0.84rem;
      font-variant-caps: all-small-caps;
      letter-spacing: 0.14em;
      line-height: 1;
    }
    .footer-note.stack {
      display: grid;
      gap: 6px;
      line-height: 1.2;
    }
    .footer-brand {
      color: var(--text);
      font-size: 0.88rem;
      font-weight: 700;
      font-variant-caps: all-small-caps;
      letter-spacing: 0.16em;
    }
    .footer-tagline {
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      font-variant-caps: all-small-caps;
    }
    .footer-meta {
      font-size: 0.76rem;
      font-variant-caps: all-small-caps;
      letter-spacing: 0.14em;
    }
    .footer-meta a {
      color: inherit;
      text-decoration: none;
      border-bottom: 1px solid rgba(236,227,218,0.22);
    }
    .footer-meta a:hover {
      color: var(--text);
      border-bottom-color: rgba(236,227,218,0.45);
    }
    .export-btn {
      cursor: pointer;
      transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
    }
    .export-btn:hover, .export-btn.copied {
      color: var(--text);
      border-color: rgba(216,132,98,0.45);
      background: var(--accent-soft);
    }
      .container { padding: 20px 14px 48px; }
      .hero { padding: 20px; }
      .hero-top { grid-template-columns: 1fr; }
      .meta { justify-content: flex-start; margin-top: 8px; }
      .wordmark { width: 280px; height: 92px; }
      th:nth-child(5), td:nth-child(5) { display: none; }
      .event summary { align-items: flex-start; }
    }
  </style>
</head>
<body>${body}${script ? `<script>${script}</script>` : ""}</body>
</html>`;
}

function copyButton(value: string, label: string, className = "copy-btn"): string {
  return `<button class="${escapeHtml(className)}" type="button" data-copy-value="${escapeHtml(value)}" aria-label="Copy ${escapeHtml(label)}" title="Copy ${escapeHtml(label)}"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>`;
}

function exportButton(data: any): string {
  const payload = JSON.stringify({
    kind: "notrace-export",
    traceId: data.traceId,
    repository: data.repository?.name,
    branch: data.repository?.branch,
    task: data.task,
    metrics: data.activity?.totals,
    summary: data.telemetry?.extensions?.noheadroom?.summary,
    events: (data.events || []).filter((e: any) => e.type === "llm_completion").map((e: any) => ({
      model: e.model,
      input: e.inputPayload?.messages,
      output: e.outputContent
    }))
  });
  return `<button class="export-btn" type="button" data-copy-value="${escapeHtml(payload)}" title="Copy session data for LLM/Agent context"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>Export</span></button>`;
}

function copyScript(): string {
  return `(() => {
    document.querySelectorAll('[data-copy-value]').forEach((button) => {
      button.addEventListener('click', async () => {
        const value = button.getAttribute('data-copy-value') || '';
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
          } else {
            const textarea = document.createElement('textarea');
            textarea.value = value;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
          }
          const previous = button.innerHTML;
          button.classList.add('copied');
          button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>';
          setTimeout(() => {
            button.classList.remove('copied');
            button.innerHTML = previous;
          }, 1400);
        } catch {
          button.textContent = 'ERR';
        }
      });
    });
  })();`;
}

function renderJsonBlock(title: string, value: unknown): string {
  return `<section class="block"><h4>${escapeHtml(title)}</h4><pre>${escapeHtml(typeof value === "string" ? value : JSON.stringify(value, null, 2))}</pre></section>`;
}

function renderToolUseHtml(name: string, input: any): string {
  const parsedInput = typeof input === "string" ? (() => { try { return JSON.parse(input); } catch { return input; } })() : input;
  return `<div class="chat-tool-use"><div class="chat-tool-header"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg> ${escapeHtml(name)}</div><pre class="chat-tool-body">${escapeHtml(typeof parsedInput === 'string' ? parsedInput : JSON.stringify(parsedInput, null, 2))}</pre></div>`;
}

function renderToolResultHtml(id: string, content: any): string {
  return `<div class="chat-tool-use"><div class="chat-tool-header" style="color: var(--muted);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg> Tool Result: ${escapeHtml(id)}</div><pre class="chat-tool-body">${escapeHtml(typeof content === 'string' ? content : JSON.stringify(content, null, 2))}</pre></div>`;
}

function renderUniversalMessageContent(m: any): string {
  if (!m) return "";
  let html = "";

  // 1. Handle string content or Anthropic/Pi blocks
  if (typeof m.content === "string" && m.content.trim()) {
    html += `<div class="chat-text">${escapeHtml(m.content)}</div>`;
  } else if (Array.isArray(m.content)) {
    html += m.content.map((block: any) => {
      if (!block) return "";
      if (block.type === "text") return `<div class="chat-text">${escapeHtml(block.text)}</div>`;
      if (block.type === "tool_use") return renderToolUseHtml(block.name, block.input);
      if (block.type === "tool_result") return renderToolResultHtml(block.tool_use_id || "unknown", block.content);
      return `<pre class="chat-tool-body">${escapeHtml(JSON.stringify(block, null, 2))}</pre>`;
    }).join("");
  } else if (m.content && typeof m.content === "object") {
    html += `<pre class="chat-tool-body">${escapeHtml(JSON.stringify(m.content, null, 2))}</pre>`;
  }

  // 2. Handle OpenAI/Codex tool_calls (attached to message, not in content)
  if (Array.isArray(m.tool_calls)) {
    html += m.tool_calls.map((tc: any) => {
      if (tc.type === "function" && tc.function) {
        return renderToolUseHtml(tc.function.name, tc.function.arguments);
      }
      return "";
    }).join("");
  }

  // 3. Handle OpenAI legacy function_call
  if (m.function_call) {
    html += renderToolUseHtml(m.function_call.name, m.function_call.arguments);
  }

  // 4. Handle OpenAI tool result (message role is "tool")
  if (m.role === "tool" && !html.includes("chat-tool-result")) {
    // If it was just a string, it rendered above. Wrap it in a tool result block instead.
    html = renderToolResultHtml(m.tool_call_id || m.name || "unknown", m.content);
  }

  return html || `<div class="empty">Empty message</div>`;
}

function renderMessages(messages: any[] | undefined): string {
  if (!messages?.length) return "";
  return `<section class="block"><h4>Input Messages</h4>${messages.map(m => `<div class="msg ${escapeHtml(m?.role || "unknown")}"><div class="msg-head"><span class="msg-role">${escapeHtml(m?.role || "unknown")}</span></div><div class="msg-content">${renderUniversalMessageContent(m)}</div></div>`).join("")}</section>`;
}

function eventBadgeClass(ev: any): string {
  if (ev.type === "llm_completion") return "badge badge-llm";
  if (ev.type === "tool_start" || ev.type === "tool_end") return ev.isError ? "badge badge-error" : "badge badge-tool";
  return "badge badge-system";
}

function eventTitle(ev: any): string {
  return ev.model || ev.toolName || ev.type;
}

function renderEventCard(ev: any): string {
  const sections: string[] = [];
  if (ev.type === "llm_completion") {
    sections.push(renderMessages(ev.inputPayload?.messages));
    if (ev.stopReason && ev.stopReason !== "stop" && ev.stopReason !== "toolUse") {
      sections.push(renderJsonBlock("Stop Reason", ev.stopReason));
    }
    if (ev.errorMessage) {
      sections.push(renderJsonBlock("Error Message", ev.errorMessage));
    }
    sections.push(`<section class="block"><h4>Output</h4><div class="msg-content">${renderUniversalMessageContent({ content: ev.outputContent })}</div></section>`);
    if (ev.usage) sections.push(renderJsonBlock("Usage", ev.usage));
  } else if (ev.type === "tool_start") {
    sections.push(`<section class="block"><h4>Arguments</h4><div class="msg-content"><div class="chat-tool-use"><div class="chat-tool-header"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg> Execution Input</div><pre class="chat-tool-body">${escapeHtml(typeof ev.args === 'string' ? ev.args : JSON.stringify(ev.args, null, 2))}</pre></div></div></section>`);
  } else if (ev.type === "tool_end") {
    sections.push(`<section class="block"><h4>${ev.isError ? "Error Result" : "Result"}</h4><div class="msg-content"><div class="chat-tool-use" style="${ev.isError ? 'border-color: rgba(239,127,127,0.3);' : ''}"><div class="chat-tool-header" style="${ev.isError ? 'color: var(--err);' : 'color: var(--muted);'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg> Execution Output</div><pre class="chat-tool-body">${escapeHtml(typeof ev.result === 'string' ? ev.result : JSON.stringify(ev.result, null, 2))}</pre></div></div></section>`);
  } else {
    sections.push(renderJsonBlock("Event", ev));
  }

  return `<details class="event">
    <summary>
      <div class="event-main">
        <span class="${eventBadgeClass(ev)}">${escapeHtml(ev.type)}</span>
        <span class="event-title">${escapeHtml(eventTitle(ev))}</span>
      </div>
      <span class="event-time">${formatTime(ev.timestamp)}</span>
    </summary>
    <div class="event-body"><div class="stack">${sections.join("")}</div></div>
  </details>`;
}

function dashboardSortScript(): string {
  return `(() => {
    const table = document.querySelector('[data-dashboard-table]');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const buttons = Array.from(document.querySelectorAll('[data-sort-key]'));
    let currentKey = 'index';
    let currentDir = 'desc';

    function icon(dir) {
      return dir === 'asc' ? '↑' : '↓';
    }

    function updateState() {
      buttons.forEach(btn => {
        const key = btn.getAttribute('data-sort-key');
        const state = btn.querySelector('.sort-state');
        if (!state) return;
        state.textContent = key === currentKey ? icon(currentDir) : '';
      });
    }

    function compare(a, b, key) {
      if (key === 'index' || key === 'started' || key === 'tokens' || key === 'cost') {
        return Number(a.dataset[key] || 0) - Number(b.dataset[key] || 0);
      }
      return String(a.dataset[key] || '').localeCompare(String(b.dataset[key] || ''));
    }

    function sortBy(key) {
      const rows = Array.from(tbody.querySelectorAll('tr'));
      rows.sort((a, b) => {
        const result = compare(a, b, key);
        return currentDir === 'asc' ? result : -result;
      });
      rows.forEach(row => tbody.appendChild(row));
      updateState();
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-sort-key') || 'index';
        if (currentKey === key) currentDir = currentDir === 'asc' ? 'desc' : 'asc';
        else {
          currentKey = key;
          currentDir = key === 'workflow' ? 'asc' : 'desc';
        }
        sortBy(currentKey);
      });
    });

    sortBy(currentKey);
  })();`;
}

export function generateDashboardHtml(sessions: any[], options: any = {}): string {
  const reversed = sessions.slice().reverse();
  const totalCost = sessions.reduce((sum, s) => sum + Number(s.activity?.totals?.totalCostUsd || 0), 0);
  const totalTokens = sessions.reduce((sum, s) => sum + Number(s.activity?.totals?.totalTokens || 0), 0);
  const homeHref = options?.indexHref || "index.html";
  const body = `<div class="container">
    <section class="hero">
      <div class="hero-split">
        <a class="brand-link" href="${escapeHtml(homeHref)}">${wordmarkSvg()}</a>
        <div class="hero-right">
          <div class="hero-session">
            <strong style="color: var(--text); font-weight: 500;">Global Index</strong>
            <span style="color: var(--muted);">Machine-wide session evidence.</span>
          </div>
          <div class="hero-meta">
            <span class="hero-pill">${sessions.length} sessions</span>
          </div>
        </div>
      </div>
      <div class="metrics">
        <div class="metric-card"><small>Sessions</small><strong>${sessions.length}</strong></div>
        <div class="metric-card"><small>Total Tokens</small><strong>${totalTokens.toLocaleString()}</strong></div>
        <div class="metric-card"><small>Total Cost</small><strong>${formatUsd(totalCost)}</strong></div>
      </div>
    </section>
    <section class="panel">
      <h2 class="section-title">Session Reports</h2>
      ${reversed.length ? `<table data-dashboard-table><thead><tr><th class="col-index sortable-head"><button class="sort-btn" data-sort-key="index"><span class="sort-label">#</span><span class="sort-state">↓</span></button></th><th>Session</th><th>Project</th><th class="sortable-head"><button class="sort-btn" data-sort-key="workflow"><span class="sort-label">Workflow</span><span class="sort-state"></span></button></th><th class="sortable-head"><button class="sort-btn" data-sort-key="started"><span class="sort-label">Started</span><span class="sort-state"></span></button></th><th>Task</th><th class="sortable-head num-cell"><button class="sort-btn" data-sort-key="tokens"><span class="sort-label">Tokens</span><span class="sort-state"></span></button></th><th class="sortable-head num-cell"><button class="sort-btn" data-sort-key="cost"><span class="sort-label">Cost</span><span class="sort-state"></span></button></th></tr></thead><tbody>
      ${reversed.map((s, index) => {
        const link = s.artifacts?.html ? (s.artifacts.html.startsWith(".notrace/") ? s.artifacts.html.substring(9) : s.artifacts.html) : "#";
        const workflow = s.task?.workflow || "generic";
        const workflowLabel = workflowDisplayName(workflow);
        const tokens = Number(s.activity?.totals?.totalTokens || 0);
        const cost = Number(s.activity?.totals?.totalCostUsd || 0);
        return `<tr data-index="${reversed.length - index}" data-workflow="${escapeHtml(workflowLabel)}" data-started="${parseDate(s.startedAt)?.getTime() || 0}" data-tokens="${tokens}" data-cost="${cost}"><td class="index-cell">${reversed.length - index}</td><td><a class="session-link" href="${escapeHtml(link)}"><strong>${escapeHtml(String(s.sessionId).slice(0, 8))}</strong><span class="session-sub">${escapeHtml(String(s.sessionId))}</span></a></td><td><span class="hero-pill">${escapeHtml(s.repositoryName || "Unknown")}</span></td><td><span class="workflow-pill ${workflowClassName(workflow)}">${escapeHtml(workflowLabel)}</span></td><td>${formatDateCell(s.startedAt)}</td><td>${escapeHtml(taskDisplay(s))}</td><td class="num-cell">${tokens.toLocaleString()}</td><td class="num-cell">${formatUsd(cost)}</td></tr>`;
      }).join("")}
      </tbody></table>` : `<div class="empty">No sessions yet. Run Pi with notrace enabled. New reports appear here.</div>`}
    </section>
    <footer class="footer-note minimal">notrace • raquezha 2026</footer>
  </div>`;
  return shell("notrace", body, dashboardSortScript());
}

export function generateHtmlReport(data: any): string {
  const visibleEvents = (data.events || []).filter((ev: any) => ev.type !== "session_start" && ev.type !== "turn_start");
  const indexHref = data?.navigation?.indexHref || "../../index.html";
  const repositoryName = resolveRepoName(data);
  const task = data.task;
  const body = `<div class="container">
    <section class="hero">
      <div class="hero-top">
        <div>
          <div class="brand"><a class="brand-link" href="${escapeHtml(indexHref)}" onclick="if (window.history.length > 1) { window.history.back(); return false; }">${wordmarkSvg()}</a><p class="subtitle session-subtitle"><span>Session retrospective</span><span class="session-id-chip"><span>${escapeHtml(data.traceId)}</span>${copyButton(String(data.traceId || ""), "session ID")}</span></p></div>
        </div>
        <div class="meta">
          <span class="pill">${escapeHtml(resolveRepoName(data))}</span>
          <span class="pill">Started ${formatDateLong(data.session?.startedAt)}</span>
          <span class="pill">Mode: ${escapeHtml(data.captureMode || "full")}</span>
          ${exportButton(data)}
        </div>
      </div>
      <div class="metrics">
        <div class="metric-card"><small>Total Cost</small><strong>${formatUsd(data.activity?.totals?.totalCostUsd)}</strong></div>
        <div class="metric-card"><small>Total Tokens</small><strong>${Number(data.activity?.totals?.totalTokens || 0).toLocaleString()}</strong></div>
        <div class="metric-card"><small>Input Tokens</small><strong>${Number(data.activity?.totals?.inputTokens || 0).toLocaleString()}</strong></div>
        <div class="metric-card"><small>Output Tokens</small><strong>${Number(data.activity?.totals?.outputTokens || 0).toLocaleString()}</strong></div>
        <div class="metric-card"><small>Tool Calls</small><strong>${Number(data.activity?.toolCallCount || 0)}</strong></div>
        <div class="metric-card"><small>Events</small><strong>${visibleEvents.length}</strong></div>
      </div>
    </section>
    <section class="panel">
      <h2 class="section-title">Run Summary</h2>
      <div style="padding: 16px;" class="stack">
        ${renderJsonBlock("Session", data.session || {})}
        ${renderJsonBlock("Task", task || { workflow: "generic", id: null })}
        ${renderJsonBlock("Conditions", data.conditions || {})}
        ${renderJsonBlock("Activity", data.activity || {})}
      </div>
    </section>
    <section class="panel" style="margin-top: 24px;">
      <h2 class="section-title">Dynamic Extension Telemetry</h2>
      <div style="padding: 16px;" class="stack">
        ${Object.entries(data.telemetry?.extensions || {}).length ? Object.entries(data.telemetry.extensions).map(([name, ext]: [string, any]) => renderJsonBlock(`${name} (${formatTelemetryStatus(ext?.status)})`, { summary: ext?.summary || null, ...ext?.details })).join("") : `<div class="empty">No extension telemetry captured for this run.</div>`}
      </div>
    </section>
    <section class="panel" style="margin-top: 24px;">
      <h2 class="section-title">Timeline</h2>
      <div style="padding: 16px;">
        <div class="timeline">${visibleEvents.map(renderEventCard).join("") || `<div class="empty">No visible events captured.</div>`}</div>
      </div>
    </section>
    <footer class="footer-note stack">
      <div class="footer-brand">notrace</div>
      <div class="footer-tagline">Local-first retrospective engine</div>
      <div class="footer-meta"><a href="https://opensource.org/licenses/MIT">MIT</a></div>
    </footer>
  </div>`;
  return shell(`notrace - ${data.traceId}`, body, copyScript());
}
