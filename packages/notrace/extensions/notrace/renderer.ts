export function escapeHtml(v: unknown): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" };
  return String(v ?? "").replace(/[&<>'"]/g, c => map[c]);
}

export function safeJsonForScript(v: any): string {
  const map: Record<string, string> = { "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "\u2028": "\\u2028", "\u2029": "\\u2029" };
  return JSON.stringify(v).replace(/[<>&\u2028\u2029]/g, c => map[c]);
}

export function generateDashboardHtml(sessions: any[]): string {
  const reversed = sessions.slice().reverse();
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>notrace</title><style>
    :root { --bg: #0f0e0d; --panel: #1a1816; --text: #f5eee7; --accent: #d88462; --border: rgba(255,255,255,0.08); }
    body { font-family: sans-serif; background: var(--bg); color: var(--text); padding: 40px; background-image: radial-gradient(circle at 50% 0%, rgba(216,132,98,0.1), transparent 50%); background-attachment: fixed; }
    .container { max-width: 1000px; margin: 0 auto; }
    h1 span { color: var(--accent); }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border-radius: 12px; overflow: hidden; border: 1px solid var(--border); }
    th, td { padding: 16px 24px; text-align: left; border-bottom: 1px solid var(--border); }
    .btn { background: var(--accent); color: white; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 0.85rem; font-weight: 600; }
  </style></head><body><div class="container"><h1>no<span>trace</span> Dashboard</h1>
    <table><thead><tr><th>Session</th><th>Workflow</th><th>Started</th><th>Actions</th></tr></thead><tbody>
      ${reversed.map(s => {
        // Strip the ".notrace/" prefix from artifacts.html if it exists, 
        // because index.html is already inside the .notrace folder.
        const link = s.artifacts.html.startsWith('.notrace/') 
          ? s.artifacts.html.substring(9) 
          : s.artifacts.html;
        return `<tr><td>${escapeHtml(s.sessionId.slice(0, 8))}</td><td>${escapeHtml(s.workflow || 'generic')}</td><td>${new Date(s.startedAt).toLocaleString()}</td><td><a class="btn" href="${link}">View</a></td></tr>`;
      }).join('')}
    </tbody></table></div></body></html>`;
}

export function generateHtmlReport(data: any): string {
  const serialized = safeJsonForScript(data);
  return `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"><title>notrace - ${data.traceId}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0c0b0a;
      --text: #ece3da;
      --accent: #d88462;
      --panel: rgba(255,255,255,0.03);
      --border: rgba(255, 255, 255, 0.08);
      --shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
    body {
      font-family: 'Outfit', sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 40px 20px;
      line-height: 1.6;
      background-image: radial-gradient(circle at 50% -20%, rgba(216,132,98,0.15), transparent 50%);
      background-attachment: fixed;
    }
    .container { max-width: 900px; margin: 0 auto; }
    .hero {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 32px;
      padding: 48px;
      margin-bottom: 40px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(12px);
    }
    .brand h1 { font-size: 3rem; font-weight: 800; letter-spacing: -0.05em; margin: 0; }
    .brand h1 span { color: var(--accent); }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 48px; }
    .metric-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 24px;
      transition: transform 0.2s;
    }
    .metric-card:hover { transform: translateY(-4px); border-color: var(--accent); }
    .metric-card small { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; color: var(--accent); letter-spacing: 0.1em; }
    .metric-card div { font-size: 1.8rem; font-weight: 700; margin-top: 4px; }
    .card { background: var(--panel); border: 1px solid var(--border); border-radius: 24px; margin-bottom: 20px; overflow: hidden; }
    .card-header { padding: 24px 32px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
    .card-header:hover { background: rgba(255,255,255,0.02); }
    .card-body { padding: 0 32px 32px; display: none; }
    .expanded .card-body { display: block; }
    .msg-row { padding: 20px; border-radius: 20px; border: 1px solid var(--border); margin-bottom: 16px; font-size: 0.95rem; }
    .msg-row.user { background: rgba(138, 183, 255, 0.05); }
    .msg-row.assistant { background: rgba(216, 132, 98, 0.05); }
    .code-block {
      background: #080706;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      font-family: 'JetBrains Mono', monospace;
      white-space: pre-wrap;
      font-size: 0.85rem;
      color: #e2d8ce;
    }
    .badge { font-size: 0.65rem; font-weight: 800; padding: 6px 12px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge-llm { background: rgba(216, 132, 98, 0.1); color: var(--accent); border: 1px solid rgba(216, 132, 98, 0.2); }
  </style></head><body><div class="container">
    <div class="hero"><div class="brand"><h1>no<span>trace</span></h1></div><p style="font-size: 1.1rem; opacity: 0.8;">Retrospective &bull; ${data.traceId}</p></div>
    <div class="metrics">
      <div class="metric-card"><small>Cost</small><div>$${data.metrics.totalCost.toFixed(5)}</div></div>
      <div class="metric-card"><small>Tokens</small><div>${data.metrics.totalTokens.toLocaleString()}</div></div>
      <div class="metric-card"><small>Turns</small><div>${data.metrics.turnCount}</div></div>
    </div>
    <div id="timeline"></div>
  </div><script>
    const data = ${serialized}; const container = document.getElementById('timeline');
    data.events.forEach(ev => {
      if (ev.type === 'session_start' || ev.type === 'turn_start') return;
      const card = document.createElement('div'); card.className = 'card';
      let bodyHtml = '';
      if (ev.type === 'llm_completion') {
        let msgs = ''; if (ev.inputPayload && ev.inputPayload.messages) ev.inputPayload.messages.forEach(m => msgs += \`<div class="msg-row \${m.role}"><strong>\${m.role.toUpperCase()}</strong><br><br>\${m.content}</div>\`);
        bodyHtml = \`<div>\${msgs}</div><div class="code-block">\${typeof ev.outputContent === 'string' ? ev.outputContent : JSON.stringify(ev.outputContent, null, 2)}</div>\`;
      } else { bodyHtml = \`<div class="code-block">\${JSON.stringify(ev, null, 2)}</div>\`; }
      card.innerHTML = \`<div class="card-header" onclick="this.parentElement.classList.toggle('expanded')"><div style="display:flex; align-items:center; gap:12px;"><span class="badge badge-llm">\${ev.type}</span><span style="font-weight:600;">\${ev.model || ev.toolName || ev.type}</span></div><span>\${new Date(ev.timestamp).toLocaleTimeString()}</span></div><div class="card-body">\${bodyHtml}</div>\`;
      container.appendChild(card);
    });
  </script></body></html>`;
}
