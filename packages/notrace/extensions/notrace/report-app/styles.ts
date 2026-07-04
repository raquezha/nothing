export const STYLES = `:root {
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
    .hero-split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: start;
    }
    .hero-right {
      display: grid;
      gap: 12px;
      justify-items: end;
      min-width: 0;
    }
    .hero-session {
      display: grid;
      gap: 4px;
      text-align: right;
      min-width: 0;
    }
    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
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
      min-width: 0;
    }
    .metric-card small { display: block; color: var(--accent); text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.72rem; font-weight: 700; }
    .metric-card strong { display: block; margin-top: 8px; font-size: clamp(1rem, 2vw, 1.55rem); overflow-wrap: anywhere; }
    .panel { padding: 0; overflow: hidden; }
    .section-title { margin: 0; padding: 20px 22px; border-bottom: 1px solid var(--border); font-size: 1rem; }
    .summary-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .kv-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
    .kv-card {
      background: rgba(0,0,0,0.18);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
    }
    .kv-title {
      font-size: 0.72rem;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 700;
      letter-spacing: 0.08em;
      margin-bottom: 10px;
    }
    .kv-list { display: grid; gap: 8px; }
    .kv-row { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
    .kv-key { color: var(--muted); }
    .kv-value { color: var(--text); text-align: right; word-break: break-word; }
    .tiny-breakdown {
      margin-top: -10px;
      margin-bottom: 8px;
      color: var(--muted);
      font-size: 0.82rem;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
    }
    .tiny-breakdown strong { color: var(--text); font-size: inherit; font-weight: 600; }
    .collapsible { margin-top: 24px; }
    .collapsible > summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 22px; font-size: 1rem; font-weight: 700; }
    .collapsible > summary::-webkit-details-marker { display: none; }
    .collapsible > summary:hover { background: rgba(255,255,255,0.02); }
    .collapsible > summary::after { content: "▾"; color: var(--muted); font-size: 0.9rem; }
    .collapsible:not([open]) > summary::after { content: "▸"; }
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
    .back-to-top {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 20;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: rgba(12,11,10,0.88);
      color: var(--text);
      text-decoration: none;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px);
      transition: opacity 160ms ease, transform 160ms ease, border-color 120ms ease, background 120ms ease;
    }
    .back-to-top.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    .back-to-top:hover { border-color: rgba(216,132,98,0.45); background: rgba(216,132,98,0.12); }
      .container { padding: 20px 14px 48px; }
      .hero { padding: 20px; }
      .hero-top, .hero-split { grid-template-columns: 1fr; }
      .meta, .hero-meta { justify-content: flex-start; margin-top: 8px; }
      .hero-right, .hero-session { justify-items: start; text-align: left; }
      .wordmark { width: min(280px, 100%); height: auto; }
      .metrics { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
      th:nth-child(5), td:nth-child(5) { display: none; }
      .event summary { align-items: flex-start; }
    }`;
