import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import * as path from "node:path";

/**
 * html-observability extension
 *
 * Captures execution traces from the pi coding agent sessions and writes
 * a self-contained, interactive, beautiful HTML report to the active task's
 * workspace at the end of the session.
 */
export default function (pi: ExtensionAPI) {
  const events: any[] = [];
  const sessionStartTime = Date.now();
  let traceId = "";
  let activeLlmPayload: any = null;
  let llmStartTime = 0;
  const activeToolTimes: Record<string, number> = {};

  // Helper to extract active task path from .workflow/active_task.json
  function getActiveTaskDir(cwd: string): string {
    try {
      const activeTaskJsonPath = path.join(cwd, ".workflow", "active_task.json");
      if (existsSync(activeTaskJsonPath)) {
        const content = JSON.parse(readFileSync(activeTaskJsonPath, "utf-8"));
        if (content.taskPath) {
          return path.resolve(cwd, content.taskPath);
        } else if (content.active_task) {
          return path.resolve(cwd, ".workflow", "tasks", content.active_task);
        }
      }
    } catch {
      // fallback
    }
    const defaultDir = path.join(cwd, ".workflow");
    if (!existsSync(defaultDir)) {
      try { mkdirSync(defaultDir, { recursive: true }); } catch {}
    }
    return defaultDir;
  }

  // 1. Session start
  pi.on("session_start", async (event, ctx) => {
    traceId = ctx.sessionManager.getSessionId() || `session-${Date.now()}`;
    events.push({
      type: "session_start",
      timestamp: Date.now(),
      reason: event.reason,
      sessionFile: ctx.sessionManager.getSessionFile() || ""
    });
  });

  // 2. Turn start
  pi.on("turn_start", async (event, ctx) => {
    events.push({
      type: "turn_start",
      timestamp: Date.now()
    });
  });

  // 3. Turn end
  pi.on("turn_end", async (event, ctx) => {
    events.push({
      type: "turn_end",
      timestamp: Date.now()
    });
  });

  // 4. Tool start
  pi.on("tool_execution_start", async (event, ctx) => {
    const { toolCallId, toolName, args } = event;
    activeToolTimes[toolCallId] = Date.now();
    events.push({
      type: "tool_start",
      toolCallId,
      toolName,
      args,
      timestamp: Date.now()
    });
  });

  // 5. Tool end
  pi.on("tool_execution_end", async (event, ctx) => {
    const { toolCallId, toolName, result, isError } = event;
    const startTime = activeToolTimes[toolCallId] || Date.now();
    const durationMs = Date.now() - startTime;

    events.push({
      type: "tool_end",
      toolCallId,
      toolName,
      result,
      isError,
      durationMs,
      timestamp: Date.now()
    });
    delete activeToolTimes[toolCallId];
  });

  // 6. LLM call start (capture payload)
  pi.on("before_provider_request", async (event, ctx) => {
    activeLlmPayload = event.payload;
    llmStartTime = Date.now();
  });

  // 7. LLM call end (capture generation / usage)
  pi.on("message_end", async (event, ctx) => {
    const { message } = event;
    if (message.role !== "assistant") return;

    const durationMs = llmStartTime > 0 ? Date.now() - llmStartTime : 0;

    events.push({
      type: "llm_completion",
      model: message.model || "unknown",
      provider: message.provider || "unknown",
      inputPayload: activeLlmPayload,
      outputContent: message.content,
      usage: message.usage,
      durationMs,
      timestamp: Date.now()
    });

    activeLlmPayload = null;
    llmStartTime = 0;
  });

  // 8. Shutdown: Compile the HTML report and write to disk
  pi.on("session_shutdown", async (event, ctx) => {
    const sessionEndTime = Date.now();
    const totalDurationMs = sessionEndTime - sessionStartTime;

    const taskDir = getActiveTaskDir(ctx.cwd);
    const reportPath = path.join(taskDir, "notrace.html");

    // Gather statistics
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let totalCost = 0;
    let toolCallCount = 0;
    let llmCallCount = 0;

    events.forEach((e) => {
      if (e.type === "llm_completion") {
        llmCallCount++;
        if (e.usage) {
          inputTokens += e.usage.input || 0;
          outputTokens += e.usage.output || 0;
          totalTokens += e.usage.totalTokens || 0;
          totalCost += e.usage.cost?.total || 0;
        }
      } else if (e.type === "tool_start") {
        toolCallCount++;
      }
    });

    const htmlContent = generateHtmlReport({
      traceId,
      projectName: process.env.PHOENIX_PROJECT_NAME || "pi-coding-agent",
      startTime: new Date(sessionStartTime).toISOString(),
      endTime: new Date(sessionEndTime).toISOString(),
      durationMs: totalDurationMs,
      metrics: {
        totalTokens,
        inputTokens,
        outputTokens,
        totalCost: totalCost.toFixed(5),
        toolCallCount,
        llmCallCount
      },
      events
    });

    try {
      writeFileSync(reportPath, htmlContent, "utf-8");
      // Output a nice clickable file:// link to the console for the user
      console.log(`\n📊 [notrace] Observability report generated:`);
      console.log(`👉 \x1b[36mfile://${reportPath}\x1b[0m\n`);
    } catch (err: any) {
      console.warn(`[notrace] Failed to write HTML report: ${err?.message || err}`);
    }
  });
}

// Returns a self-contained premium HTML template incorporating the design tokens
function generateHtmlReport(data: any): string {
  const serializedData = JSON.stringify(data);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>notrace - ${data.traceId}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0b0e;
      --bg-panel: rgba(22, 22, 28, 0.45);
      --bg-card: rgba(30, 30, 38, 0.6);
      --border: rgba(255, 255, 255, 0.08);
      --border-hover: rgba(255, 255, 255, 0.15);
      --text: #e2e2e9;
      --text-muted: #9f9fa9;
      --accent: #8b5cf6;
      --accent-gradient: linear-gradient(135deg, #a78bfa, #8b5cf6);
      --success: #10b981;
      --error: #ef4444;
      --warning: #f59e0b;
      --info: #3b82f6;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 2rem;
      min-height: 100vh;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(59, 130, 246, 0.06) 0%, transparent 40%);
      background-attachment: fixed;
    }

    .container {
      max-width: 1100px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand h1 {
      font-size: 1.75rem;
      font-weight: 700;
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .brand-tag {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: rgba(139, 92, 246, 0.15);
      color: #c084fc;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      border: 1px solid rgba(167, 139, 250, 0.3);
    }

    .meta-time {
      font-size: 0.875rem;
      color: var(--text-muted);
      text-align: right;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
      margin-bottom: 2.5rem;
    }

    .metric-card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      padding: 1.25rem;
      border-radius: 12px;
      backdrop-filter: blur(12px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .metric-card:hover {
      border-color: var(--border-hover);
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }

    .metric-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .metric-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: #fff;
    }

    .timeline {
      position: relative;
      padding-left: 2rem;
      border-left: 2px solid var(--border);
      margin-left: 1rem;
    }

    .timeline-event {
      position: relative;
      margin-bottom: 2rem;
      animation: slideIn 0.4s ease-out;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-10px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .timeline-dot {
      position: absolute;
      left: calc(-2rem - 6px);
      top: 1.25rem;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--text-muted);
      box-shadow: 0 0 0 4px var(--bg);
      transition: all 0.3s ease;
    }

    /* Event color mappings */
    .timeline-event.session-start .timeline-dot { background: var(--info); box-shadow: 0 0 0 4px var(--bg), 0 0 8px var(--info); }
    .timeline-event.turn-start .timeline-dot { background: var(--accent); box-shadow: 0 0 0 4px var(--bg), 0 0 8px var(--accent); }
    .timeline-event.tool-call .timeline-dot { background: var(--warning); box-shadow: 0 0 0 4px var(--bg); }
    .timeline-event.tool-call.error .timeline-dot { background: var(--error); box-shadow: 0 0 0 4px var(--bg), 0 0 8px var(--error); }
    .timeline-event.llm-call .timeline-dot { background: var(--success); box-shadow: 0 0 0 4px var(--bg), 0 0 8px var(--success); }

    .card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      backdrop-filter: blur(12px);
      transition: border-color 0.2s;
    }

    .card:hover {
      border-color: var(--border-hover);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
    }

    .card-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 600;
    }

    .card-badge {
      font-size: 0.75rem;
      font-weight: 500;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
    }

    .badge-session { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
    .badge-turn { background: rgba(139, 92, 246, 0.15); color: #c084fc; }
    .badge-tool { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    .badge-tool.error { background: rgba(239, 68, 68, 0.15); color: #f87171; }
    .badge-llm { background: rgba(16, 185, 129, 0.15); color: #34d399; }

    .card-time {
      font-size: 0.8rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .arrow-icon {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: transform 0.2s;
    }

    .expanded .arrow-icon {
      transform: rotate(90deg);
    }

    .card-body {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      display: none;
    }

    .expanded .card-body {
      display: block;
    }

    .code-block {
      font-family: 'Source Code Pro', monospace;
      font-size: 0.875rem;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--border);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin-top: 0.5rem;
      color: #e2e2e9;
      white-space: pre-wrap;
    }

    .messages-container {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .msg-row {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.75rem;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 6px;
      border-left: 3px solid var(--border);
    }

    .msg-row.user { border-left-color: var(--info); }
    .msg-row.assistant { border-left-color: var(--success); }
    .msg-row.system { border-left-color: var(--accent); }

    .msg-role {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .msg-row.user .msg-role { color: #60a5fa; }
    .msg-row.assistant .msg-role { color: #34d399; }
    .msg-row.system .msg-role { color: #c084fc; }

    .msg-text {
      font-size: 0.9rem;
      white-space: pre-wrap;
    }

    .duration-pill {
      font-size: 0.75rem;
      background: rgba(255, 255, 255, 0.06);
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <h1>notrace</h1>
        <span class="brand-tag">Local Observability</span>
      </div>
      <div class="meta-time">
        <div>Session: <span id="sess-id"></span></div>
        <div id="sess-time" style="font-size: 0.8rem;"></div>
      </div>
    </header>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Duration</div>
        <div class="metric-value" id="val-duration">-</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Tokens</div>
        <div class="metric-value" id="val-tokens">-</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">LLM Calls</div>
        <div class="metric-value" id="val-llms">-</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Tool Calls</div>
        <div class="metric-value" id="val-tools">-</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Cost (USD)</div>
        <div class="metric-value" id="val-cost">-</div>
      </div>
    </div>

    <h2 style="margin-bottom: 1.5rem; font-weight: 600; font-size: 1.25rem; color: #fff;">Activity Flow</h2>
    <div class="timeline" id="timeline-container">
      <!-- Injected by JS -->
    </div>
  </div>

  <script>
    const traceData = ${serializedData};

    // Render Metrics
    document.getElementById("sess-id").textContent = traceData.traceId;
    document.getElementById("sess-time").textContent = new Date(traceData.startTime).toLocaleString();
    document.getElementById("val-duration").textContent = (traceData.durationMs / 1000).toFixed(2) + "s";
    document.getElementById("val-tokens").textContent = traceData.metrics.totalTokens.toLocaleString();
    document.getElementById("val-llms").textContent = traceData.metrics.toolCallCount; // Wait, actually traceData.metrics.llmCallCount
    document.getElementById("val-tools").textContent = traceData.metrics.toolCallCount;
    document.getElementById("val-cost").textContent = "$" + traceData.metrics.totalCost;

    // Correct the labels mapping if names swapped
    document.getElementById("val-llms").textContent = traceData.metrics.llmCallCount;

    // Process & Render Timeline
    const container = document.getElementById("timeline-container");
    const events = traceData.events;
    
    // Group start and end of tools to display them as single cards
    const toolExecutions = {};
    const renderedEvents = [];

    events.forEach(e => {
      if (e.type === "session_start") {
        renderedEvents.push({
          type: "session",
          title: "Session Initialized",
          time: new Date(e.timestamp).toLocaleTimeString(),
          body: \`Reason: \${e.reason}\\nFile: \${e.sessionFile}\`
        });
      } else if (e.type === "turn_start") {
        renderedEvents.push({
          type: "turn",
          title: "User Turn Started",
          time: new Date(e.timestamp).toLocaleTimeString(),
          body: "Agent waiting for query execution loop."
        });
      } else if (e.type === "tool_start") {
        toolExecutions[e.toolCallId] = {
          type: "tool",
          title: \`Tool Call: \${e.toolName}\`,
          toolName: e.toolName,
          time: new Date(e.timestamp).toLocaleTimeString(),
          args: e.args,
          startTime: e.timestamp
        };
      } else if (e.type === "tool_end") {
        const start = toolExecutions[e.toolCallId];
        if (start) {
          start.result = e.result;
          start.isError = e.isError;
          start.durationMs = e.durationMs;
          renderedEvents.push(start);
          delete toolExecutions[e.toolCallId];
        }
      } else if (e.type === "llm_completion") {
        renderedEvents.push({
          type: "llm",
          title: \`LLM Call: \${e.model}\`,
          model: e.model,
          provider: e.provider,
          time: new Date(e.timestamp).toLocaleTimeString(),
          durationMs: e.durationMs,
          usage: e.usage,
          payload: e.inputPayload,
          output: e.outputContent
        });
      }
    });

    // Render cards
    renderedEvents.forEach((ev, index) => {
      const evDiv = document.createElement("div");
      evDiv.className = \`timeline-event \${ev.type}-start \${ev.isError ? "error" : ""}\`;

      let cardHtml = \`
        <div class="timeline-dot"></div>
        <div class="card" id="card-\${index}">
          <div class="card-header" onclick="toggleCard(\${index})">
            <div class="card-title">
              <span class="card-badge badge-\${ev.type} \${ev.isError ? "error" : ""}">\${ev.type.toUpperCase()}</span>
              <span>\${ev.title}</span>
              \${ev.durationMs ? \`<span class="duration-pill">\${(ev.durationMs / 1000).toFixed(2)}s</span>\` : ""}
            </div>
            <div class="card-time">
              <span>\${ev.time}</span>
              <svg class="arrow-icon" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
            </div>
          </div>
          <div class="card-body">
      \`;

      if (ev.type === "session" || ev.type === "turn") {
        cardHtml += \`<div class="code-block">\${ev.body}</div>\`;
      } else if (ev.type === "tool") {
        cardHtml += \`
          <strong>Arguments:</strong>
          <div class="code-block">\${JSON.stringify(ev.args, null, 2)}</div>
          <strong style="margin-top: 1rem; display: block;">Result (\${ev.isError ? "Error" : "Success"}):</strong>
          <div class="code-block">\${typeof ev.result === "string" ? ev.result : JSON.stringify(ev.result, null, 2)}</div>
        \`;
      } else if (ev.type === "llm") {
        // Render system prompt and input messages if present
        let messagesHtml = '<div class="messages-container">';
        if (ev.payload) {
          if (ev.payload.system_instruction) {
            const instr = typeof ev.payload.system_instruction === "string" 
              ? ev.payload.system_instruction 
              : JSON.stringify(ev.payload.system_instruction);
            messagesHtml += \`
              <div class="msg-row system">
                <span class="msg-role">System Instruction</span>
                <span class="msg-text">\${instr}</span>
              </div>
            \`;
          }
          if (ev.payload.messages && Array.isArray(ev.payload.messages)) {
            ev.payload.messages.forEach(m => {
              const contentText = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
              messagesHtml += \`
                <div class="msg-row \${m.role}">
                  <span class="msg-role">\${m.role}</span>
                  <span class="msg-text">\${contentText}</span>
                </div>
              \`;
            });
          }
        }
        messagesHtml += '</div>';

        cardHtml += \`
          <strong>Context Messages:</strong>
          \${messagesHtml}
          <strong style="margin-top: 1.25rem; display: block;">Generated Response:</strong>
          <div class="code-block">\${JSON.stringify(ev.output, null, 2)}</div>
          \${ev.usage ? \`
            <div style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted); display: flex; gap: 1.5rem;">
              <span>Input Tokens: <strong>\${ev.usage.input}</strong></span>
              <span>Output Tokens: <strong>\${ev.usage.output}</strong></span>
              <span>Total Tokens: <strong>\${ev.usage.totalTokens}</strong></span>
              <span>Cost: <strong>\$\${ev.usage.cost?.total.toFixed(5) || "0.00"}</strong></span>
            </div>
          \` : ""}
        \`;
      }

      cardHtml += \`
          </div>
        </div>
      \`;

      evDiv.innerHTML = cardHtml;
      container.appendChild(evDiv);
    });

    // Expand/Collapse controller
    function toggleCard(index) {
      const card = document.getElementById(\`card-\${index}\`);
      card.classList.toggle("expanded");
    }
  </script>
</body>
</html>`;
}
