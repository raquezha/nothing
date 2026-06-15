import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import * as path from "node:path";

const REDACTED = "[REDACTED by notrace]";
const MAX_STRING_LENGTH = 20_000;
const MAX_ARRAY_ITEMS = 200;
const MAX_OBJECT_KEYS = 200;
const MAX_DEPTH = 8;

const SENSITIVE_KEY_RE = /(authorization|cookie|setcookie|password|passwd|pwd|secret|token|apikey|accesskey|accesskeyid|accessid|accesstoken|privatekey|session|credential|refreshtoken|idtoken)/i;
const SENSITIVE_VALUE_RE = /(bearer\s+[a-z0-9._~+/=-]{12,}|sk-[a-z0-9_-]{16,}|gh[pousr]_[a-z0-9_]{16,}|xox[baprs]-[a-z0-9-]{16,}|AKIA[0-9A-Z]{16})/gi;

type CaptureMode = "metadata" | "redacted" | "full";

function getCaptureMode(): CaptureMode {
  const mode = process.env.NOTRACE_CAPTURE?.toLowerCase();
  if (mode === "metadata" || mode === "full") return mode;
  return "redacted";
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "");
  if (/^(inputtokens|outputtokens|totaltokens|prompttokens|completiontokens|reasoningtokens|cachedtokens|cachecreationinputtokens|cachereadinputtokens|cost|total|input|output|prompt|completion|reasoning|read|write)$/i.test(normalized)) {
    return false;
  }
  return SENSITIVE_KEY_RE.test(normalized);
}

function sanitizeUsageValue(usage: unknown): unknown {
  if (getCaptureMode() === "full") return usage;
  if (!usage || typeof usage !== "object") return sanitizeTraceValue(usage);

  const source = usage as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number" || typeof value === "boolean" || value == null) {
      output[key] = value;
    } else if (typeof value === "object" && value) {
      output[key] = sanitizeUsageValue(value);
    } else {
      output[key] = sanitizeTraceValue(value);
    }
  }

  return output;
}

function redactString(value: string): string {
  const redacted = value.replace(SENSITIVE_VALUE_RE, REDACTED);
  if (redacted.length <= MAX_STRING_LENGTH) return redacted;
  return `${redacted.slice(0, MAX_STRING_LENGTH)}\n…[truncated ${redacted.length - MAX_STRING_LENGTH} chars by notrace]`;
}

function sanitizeTraceValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (getCaptureMode() === "full") return value;
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return `[${typeof value}]`;
  if (depth >= MAX_DEPTH) return "[Max depth reached by notrace]";
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeTraceValue(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`…[truncated ${value.length - MAX_ARRAY_ITEMS} items by notrace]`);
    return items;
  }

  const output: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, item] of entries.slice(0, MAX_OBJECT_KEYS)) {
    output[key] = isSensitiveKey(key) ? REDACTED : sanitizeTraceValue(item, depth + 1, seen);
  }
  if (entries.length > MAX_OBJECT_KEYS) output.__notrace_truncated__ = `${entries.length - MAX_OBJECT_KEYS} keys`;
  return output;
}

function safeResolveUnder(baseDir: string, candidate: string): string | null {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, candidate);
  const relative = path.relative(base, resolved);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative)) ? resolved : null;
}

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>'"]/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "'": return "&#39;";
      case '"': return "&quot;";
      default: return char;
    }
  });
}

type NotraceLocation = {
  workflowDir: string;
  notraceDir: string;
  outputDir: string;
  taskDir: string | null;
  taskId: string | null;
  taskPath: string | null;
};

type NotraceMetrics = {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  toolCallCount: number;
  toolErrorCount: number;
  llmCallCount: number;
  turnCount: number;
  models: string[];
  providers: string[];
};

function ensureWorkflowDir(workflowDir: string): void {
  if (existsSync(workflowDir)) return;
  try {
    mkdirSync(workflowDir, { recursive: true, mode: 0o700 });
  } catch {}
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 160) || `session-${Date.now()}`;
}

function getNotraceLocation(cwd: string, sessionId: string): NotraceLocation {
  const workflowDir = path.resolve(cwd, ".workflow");
  const notraceDir = path.resolve(cwd, ".notrace");
  const outputDir = path.join(notraceDir, "sessions", safePathSegment(sessionId));
  ensureWorkflowDir(workflowDir);

  try {
    const activeTaskJsonPath = path.join(workflowDir, "active_task.json");
    if (existsSync(activeTaskJsonPath)) {
      const content = JSON.parse(readFileSync(activeTaskJsonPath, "utf-8"));
      const candidate = typeof content.taskPath === "string"
        ? safeResolveUnder(cwd, content.taskPath)
        : typeof content.active_task === "string"
          ? safeResolveUnder(workflowDir, path.join("tasks", content.active_task))
          : null;

      if (candidate && safeResolveUnder(workflowDir, path.relative(workflowDir, candidate))) {
        return {
          workflowDir,
          notraceDir,
          outputDir,
          taskDir: candidate,
          taskId: typeof content.active_task === "string" ? content.active_task : path.basename(candidate),
          taskPath: path.relative(cwd, candidate)
        };
      }
    }
  } catch {
    // fallback
  }

  return {
    workflowDir,
    notraceDir,
    outputDir,
    taskDir: null,
    taskId: null,
    taskPath: null
  };
}

function updateNotraceIndex(cwd: string, location: NotraceLocation, entry: Record<string, unknown>): void {
  const indexPath = path.join(location.notraceDir, "index.json");
  const base = {
    schemaVersion: 1,
    kind: "notrace-index",
    workdir: ".",
    sessions: [] as Record<string, unknown>[]
  };

  try {
    mkdirSync(location.notraceDir, { recursive: true, mode: 0o700 });
    const existing = existsSync(indexPath)
      ? JSON.parse(readFileSync(indexPath, "utf-8"))
      : base;
    const sessions = Array.isArray(existing.sessions) ? existing.sessions : [];
    const sessionId = entry.sessionId;
    const nextSessions = sessions.filter((item: any) => item?.sessionId !== sessionId);
    nextSessions.push(entry);
    const next = {
      ...base,
      ...existing,
      schemaVersion: 1,
      kind: "notrace-index",
      workdir: ".",
      sessions: nextSessions
    };
    writeFileSync(indexPath, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
  } catch {
    // keep notrace non-fatal if index update fails
  }
}

function appendWorkLogEntry(taskDir: string, message: string): void {
  const workMd = path.join(taskDir, "WORK.md");
  if (!existsSync(workMd)) return;

  try {
    const text = readFileSync(workMd, "utf-8");
    const entry = `- ${new Date().toISOString()}: ${message}`;

    if (!/^(## )?\[LOG\]\s*$/m.test(text)) {
      writeFileSync(workMd, `${text.trimEnd()}\n\n## [LOG]\n${entry}\n`, { encoding: "utf-8" });
      return;
    }

    const lines = text.split("\n");
    const logIndex = lines.findIndex((line) => /^(## )?\[LOG\]\s*$/.test(line));
    if (logIndex === -1) return;

    let nextSectionIndex = lines.length;
    for (let i = logIndex + 1; i < lines.length; i++) {
      if (/^(## )?\[[A-Z0-9_-]+\]\s*$/.test(lines[i])) {
        nextSectionIndex = i;
        break;
      }
    }

    const before = lines.slice(0, nextSectionIndex);
    const after = lines.slice(nextSectionIndex);
    while (before.length > logIndex + 1 && before[before.length - 1]?.trim() === "") {
      before.pop();
    }
    before.push(entry);

    writeFileSync(workMd, `${[...before, ...after].join("\n").replace(/\n*$/, "\n")}`, { encoding: "utf-8" });
  } catch {
    // keep notrace non-fatal if WORK.md append fails
  }
}

function collectMetrics(events: any[]): NotraceMetrics {
  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalCost = 0;
  let toolCallCount = 0;
  let toolErrorCount = 0;
  let llmCallCount = 0;
  let turnCount = 0;
  const models = new Set<string>();
  const providers = new Set<string>();

  for (const event of events) {
    if (event.type === "turn_start") {
      turnCount++;
      continue;
    }

    if (event.type === "tool_start") {
      toolCallCount++;
      continue;
    }

    if (event.type === "tool_end") {
      if (event.isError) toolErrorCount++;
      continue;
    }

    if (event.type === "llm_completion") {
      llmCallCount++;
      if (typeof event.model === "string" && event.model) models.add(event.model);
      if (typeof event.provider === "string" && event.provider) providers.add(event.provider);
      if (event.usage) {
        inputTokens += event.usage.input || 0;
        outputTokens += event.usage.output || 0;
        totalTokens += event.usage.totalTokens || 0;
        totalCost += event.usage.cost?.total || 0;
      }
    }
  }

  return {
    totalTokens,
    inputTokens,
    outputTokens,
    totalCost,
    toolCallCount,
    toolErrorCount,
    llmCallCount,
    turnCount,
    models: [...models],
    providers: [...providers]
  };
}

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
      args: getCaptureMode() === "metadata" ? "[metadata-only capture]" : sanitizeTraceValue(args),
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
      result: getCaptureMode() === "metadata" ? "[metadata-only capture]" : sanitizeTraceValue(result),
      isError,
      durationMs,
      timestamp: Date.now()
    });
    delete activeToolTimes[toolCallId];
  });

  // 6. LLM call start (capture payload)
  pi.on("before_provider_request", async (event, ctx) => {
    activeLlmPayload = getCaptureMode() === "metadata" ? null : sanitizeTraceValue(event.payload);
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
      outputContent: getCaptureMode() === "metadata" ? "[metadata-only capture]" : sanitizeTraceValue(message.content),
      usage: sanitizeUsageValue(message.usage),
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
    const projectName = process.env.PHOENIX_PROJECT_NAME || "pi-coding-agent";
    const captureMode = getCaptureMode();
    const location = getNotraceLocation(ctx.cwd, traceId);
    const reportPath = path.join(location.outputDir, "notrace.html");
    const recordPath = path.join(location.outputDir, "notrace.json");
    const reviewPath = path.join(location.outputDir, "notrace.review.json");
    const metrics = collectMetrics(events);
    const sessionFile = ctx.sessionManager.getSessionFile() || null;

    const htmlContent = generateHtmlReport({
      traceId,
      projectName,
      startTime: new Date(sessionStartTime).toISOString(),
      endTime: new Date(sessionEndTime).toISOString(),
      durationMs: totalDurationMs,
      metrics: {
        totalTokens: metrics.totalTokens,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        totalCost: metrics.totalCost.toFixed(5),
        toolCallCount: metrics.toolCallCount,
        llmCallCount: metrics.llmCallCount
      },
      events
    });

    const runRecord = {
      schemaVersion: 1,
      kind: "notrace-run",
      traceId,
      runtime: "pi",
      projectName,
      captureMode,
      session: {
        id: traceId,
        cwd: ctx.cwd,
        file: sessionFile
      },
      task: location.taskId || location.taskPath
        ? {
            id: location.taskId,
            path: location.taskPath
          }
        : null,
      conditions: {
        models: metrics.models,
        providers: metrics.providers
      },
      activity: {
        startTime: new Date(sessionStartTime).toISOString(),
        endTime: new Date(sessionEndTime).toISOString(),
        durationMs: totalDurationMs,
        turnCount: metrics.turnCount,
        llmCallCount: metrics.llmCallCount,
        toolCallCount: metrics.toolCallCount,
        toolErrorCount: metrics.toolErrorCount,
        totals: {
          totalTokens: metrics.totalTokens,
          inputTokens: metrics.inputTokens,
          outputTokens: metrics.outputTokens,
          totalCostUsd: Number(metrics.totalCost.toFixed(5))
        }
      },
      artifacts: {
        htmlReportPath: path.relative(ctx.cwd, reportPath),
        recordPath: path.relative(ctx.cwd, recordPath),
        reviewPath: path.relative(ctx.cwd, reviewPath)
      },
      evidence: {
        events
      }
    };

    try {
      mkdirSync(location.outputDir, { recursive: true, mode: 0o700 });
      writeFileSync(reportPath, htmlContent, { encoding: "utf-8", mode: 0o600 });
      writeFileSync(recordPath, `${JSON.stringify(runRecord, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
      updateNotraceIndex(ctx.cwd, location, {
        sessionId: traceId,
        startedAt: new Date(sessionStartTime).toISOString(),
        endedAt: new Date(sessionEndTime).toISOString(),
        taskId: location.taskId,
        taskPath: location.taskPath,
        artifacts: {
          record: path.relative(ctx.cwd, recordPath),
          html: path.relative(ctx.cwd, reportPath),
          review: path.relative(ctx.cwd, reviewPath)
        }
      });
      if (location.taskDir && (location.taskId || location.taskPath)) {
        appendWorkLogEntry(location.taskDir, `notrace captured artifacts: ${path.relative(location.taskDir, reportPath)}, ${path.relative(location.taskDir, recordPath)}`);
      }
      console.log(`\n📊 [notrace] Observability artifacts generated:`);
      console.log(`👉 \x1b[36mfile://${reportPath}\x1b[0m`);
      console.log(`🧾 \x1b[36mfile://${recordPath}\x1b[0m\n`);
    } catch (err: any) {
      console.warn(`[notrace] Failed to write notrace artifacts: ${err?.message || err}`);
    }
  });
}

function safeJsonForScript(value: any): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => {
    switch (char) {
      case "<": return "\\u003c";
      case ">": return "\\u003e";
      case "&": return "\\u0026";
      case "\u2028": return "\\u2028";
      case "\u2029": return "\\u2029";
      default: return char;
    }
  });
}

// Returns a self-contained premium HTML template incorporating the design tokens
function generateHtmlReport(data: any): string {
  const serializedData = safeJsonForScript(data);
  const escapedTraceId = escapeHtml(data.traceId);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; connect-src 'none'">
  <meta name="referrer" content="no-referrer">
  <title>notrace - ${escapedTraceId}</title>
  <style>
    :root {
      --bg: #191613;
      --bg-glow: #2a221c;
      --panel: rgba(244, 237, 228, 0.055);
      --panel-strong: rgba(244, 237, 228, 0.075);
      --paper: #f6efe7;
      --paper-soft: #e7dbce;
      --text: #f5eee7;
      --text-soft: #ddd0c2;
      --text-muted: #b9ab9d;
      --border: rgba(255, 255, 255, 0.09);
      --border-strong: rgba(255, 255, 255, 0.16);
      --accent: #d88462;
      --accent-soft: rgba(216, 132, 98, 0.14);
      --session: #8ab7ff;
      --turn: #e0b46b;
      --tool: #86cca4;
      --error: #f08e8e;
      --shadow: 0 24px 80px rgba(0, 0, 0, 0.34);
      --card-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(900px 420px at 50% -10%, rgba(216, 132, 98, 0.16), transparent 60%),
        radial-gradient(680px 360px at 10% 0%, rgba(255, 255, 255, 0.03), transparent 60%),
        linear-gradient(180deg, #171411 0%, #1b1714 100%);
      color: var(--text);
      line-height: 1.65;
      padding: 14px 12px 40px;
      min-height: 100vh;
      letter-spacing: 0.01em;
    }

    .container { max-width: 920px; margin: 0 auto; }
    header { margin-bottom: 24px; }

    .hero {
      position: relative;
      overflow: hidden;
      background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025));
      border: 1px solid var(--border);
      border-radius: 22px;
      padding: 18px 16px 16px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }

    .hero::after {
      content: "";
      position: absolute;
      inset: auto -10% -30% auto;
      width: 260px;
      height: 260px;
      background: radial-gradient(circle, rgba(216,132,98,0.14), transparent 70%);
      pointer-events: none;
    }

    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; position: relative; z-index: 1; }
    .brand h1 { font-size: 2rem; line-height: 1; font-weight: 680; color: var(--text); letter-spacing: -0.03em; }
    .brand-tag { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: #f4ccb9; background: var(--accent-soft); border: 1px solid rgba(216, 132, 98, 0.24); padding: 0.35rem 0.6rem; border-radius: 999px; }
    .hero-subtitle { position: relative; z-index: 1; color: var(--text-soft); margin-bottom: 20px; max-width: 720px; font-size: 1rem; }
    .hero-meta { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 10px; }
    .meta-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 999px; padding: 0.48rem 0.82rem; font-size: 0.86rem; color: var(--text-muted); }
    .meta-pill strong { color: var(--text); font-weight: 570; }

    .metrics-grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin: 16px 0 24px; }
    .metric-card {
      background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.028));
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 18px 16px;
      box-shadow: var(--card-shadow);
      transition: border-color 0.18s ease, transform 0.18s ease, background 0.18s ease;
    }
    .metric-card:hover { border-color: var(--border-strong); transform: translateY(-1px); background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.03)); }
    .metric-label { font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 7px; }
    .metric-value { font-size: 1.42rem; font-weight: 640; color: var(--text); letter-spacing: -0.03em; }

    .section-title {
      font-size: 0.95rem;
      font-weight: 620;
      color: var(--paper-soft);
      margin-bottom: 16px;
      padding-left: 2px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .timeline { display: flex; flex-direction: column; gap: 16px; }
    .timeline-event { position: relative; animation: slideIn 0.28s ease-out; }
    @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .timeline-dot { display: none; }

    .card {
      position: relative;
      overflow: hidden;
      background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.024));
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 14px 14px 13px;
      box-shadow: var(--card-shadow);
      transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
    }
    .card::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: rgba(255,255,255,0.1);
    }
    .timeline-event.session-start .card::before { background: var(--session); }
    .timeline-event.turn-start .card::before { background: var(--turn); }
    .timeline-event.tool-start .card::before { background: var(--tool); }
    .timeline-event.tool-start.error .card::before { background: var(--error); }
    .timeline-event.llm-start .card::before { background: var(--accent); }
    .card:hover { border-color: var(--border-strong); background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.028)); transform: translateY(-1px); }

    .card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; cursor: pointer; user-select: none; }
    .card-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-weight: 600; color: var(--text); }
    .card-title span:last-child { font-size: 1rem; letter-spacing: -0.01em; }
    .card-badge { font-size: 0.69rem; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.34rem 0.62rem; border-radius: 999px; border: 1px solid transparent; }
    .badge-session { background: rgba(138, 183, 255, 0.14); color: var(--session); border-color: rgba(138, 183, 255, 0.24); }
    .badge-turn { background: rgba(224, 180, 107, 0.14); color: var(--turn); border-color: rgba(224, 180, 107, 0.22); }
    .badge-tool { background: rgba(134, 204, 164, 0.14); color: var(--tool); border-color: rgba(134, 204, 164, 0.22); }
    .badge-tool.error { background: rgba(240, 142, 142, 0.15); color: var(--error); border-color: rgba(240, 142, 142, 0.24); }
    .badge-llm { background: rgba(216, 132, 98, 0.14); color: #f2c2ae; border-color: rgba(216, 132, 98, 0.22); }
    .card-time { flex-shrink: 0; font-size: 0.82rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px; padding-top: 3px; }
    .arrow-icon { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: transform 0.2s; }
    .expanded .arrow-icon { transform: rotate(90deg); }
    .card-body { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); display: none; }
    .expanded .card-body { display: block; }

    .detail-label { font-size: 0.76rem; font-weight: 650; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin: 14px 0 8px; display: block; }
    .code-block {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 0.84rem;
      line-height: 1.62;
      background: rgba(16, 14, 12, 0.64);
      border: 1px solid rgba(255, 255, 255, 0.06);
      padding: 14px;
      border-radius: 16px;
      overflow-x: auto;
      margin-top: 0.35rem;
      color: #f1e9df;
      white-space: pre-wrap;
    }

    .messages-container { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
    .msg-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 14px;
      background: rgba(255,255,255,0.038);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 18px;
    }
    .msg-row.user { background: rgba(138, 183, 255, 0.08); }
    .msg-row.assistant { background: rgba(216, 132, 98, 0.08); }
    .msg-row.system { background: rgba(224, 180, 107, 0.08); }
    .msg-role { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
    .msg-text { font-size: 0.93rem; color: var(--text-soft); white-space: pre-wrap; }

    .usage-row {
      margin-top: 12px;
      font-size: 0.84rem;
      color: var(--text-muted);
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.05);
    }
    .usage-row strong { color: var(--text); font-weight: 620; }
    .duration-pill { font-size: 0.74rem; background: rgba(255,255,255,0.06); padding: 0.2rem 0.46rem; border-radius: 999px; color: var(--text-muted); border: 1px solid rgba(255,255,255,0.06); }

    @media (min-width: 640px) {
      body { padding: 28px 18px 56px; }
      .hero { border-radius: 28px; padding: 28px 28px 24px; }
      .metrics-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 18px 0 30px; }
      .card { border-radius: 22px; padding: 18px 18px 16px; }
    }

    @media (max-width: 720px) {
      .hero, .card, .metric-card { border-radius: 18px; }
      .card-header { flex-direction: column; }
      .card-time { width: 100%; justify-content: space-between; }
      .brand { align-items: flex-start; flex-direction: column; gap: 8px; }
      .brand h1 { font-size: 1.8rem; }
      .hero-meta { flex-direction: column; align-items: stretch; }
      .meta-pill { width: 100%; justify-content: space-between; }
      .usage-row { flex-direction: column; gap: 6px; }
      .code-block { font-size: 0.8rem; padding: 12px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="hero">
        <div class="brand">
          <h1>notrace</h1>
          <span class="brand-tag">retrospective</span>
        </div>
        <p class="hero-subtitle">A local evidence view of the run: messages, tools, model calls, timing, and token cost.</p>
        <div class="hero-meta">
          <span class="meta-pill">Session <strong id="sess-id"></strong></span>
          <span class="meta-pill">Started <strong id="sess-time"></strong></span>
        </div>
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

    <h2 class="section-title">Activity flow</h2>
    <div class="timeline" id="timeline-container">
      <!-- Injected by JS -->
    </div>
  </div>

  <script>
    const traceData = ${serializedData};

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      }[char]));
    }

    function safeClassName(value, fallback = "unknown") {
      const normalized = String(value ?? fallback).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      return normalized || fallback;
    }

    function jsonText(value) {
      return escapeHtml(typeof value === "string" ? value : JSON.stringify(value, null, 2));
    }

    // Render Metrics
    document.getElementById("sess-id").textContent = traceData.traceId;
    document.getElementById("sess-time").textContent = new Date(traceData.startTime).toLocaleString();
    document.getElementById("val-duration").textContent = (traceData.durationMs / 1000).toFixed(2) + "s";
    document.getElementById("val-tokens").textContent = traceData.metrics.totalTokens.toLocaleString();
    document.getElementById("val-llms").textContent = traceData.metrics.llmCallCount;
    document.getElementById("val-tools").textContent = traceData.metrics.toolCallCount;
    document.getElementById("val-cost").textContent = "$" + traceData.metrics.totalCost;

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
      const eventType = safeClassName(ev.type);
      evDiv.className = \`timeline-event \${eventType}-start \${ev.isError ? "error" : ""}\`;

      let cardHtml = \`
        <div class="timeline-dot"></div>
        <div class="card" id="card-\${index}">
          <div class="card-header" onclick="toggleCard(\${index})">
            <div class="card-title">
              <span class="card-badge badge-\${eventType} \${ev.isError ? "error" : ""}">\${escapeHtml(eventType.toUpperCase())}</span>
              <span>\${escapeHtml(ev.title)}</span>
              \${ev.durationMs ? \`<span class="duration-pill">\${escapeHtml((ev.durationMs / 1000).toFixed(2))}s</span>\` : ""}
            </div>
            <div class="card-time">
              <span>\${escapeHtml(ev.time)}</span>
              <svg class="arrow-icon" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
            </div>
          </div>
          <div class="card-body">
      \`;

      if (ev.type === "session" || ev.type === "turn") {
        cardHtml += \`<div class="code-block">\${escapeHtml(ev.body)}</div>\`;
      } else if (ev.type === "tool") {
        cardHtml += \`
          <span class="detail-label">Arguments</span>
          <div class="code-block">\${jsonText(ev.args)}</div>
          <span class="detail-label">Result (\${ev.isError ? "Error" : "Success"})</span>
          <div class="code-block">\${jsonText(ev.result)}</div>
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
                <span class="msg-text">\${escapeHtml(instr)}</span>
              </div>
            \`;
          }
          if (ev.payload.messages && Array.isArray(ev.payload.messages)) {
            ev.payload.messages.forEach(m => {
              const contentText = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
              const role = safeClassName(m.role, "message");
              messagesHtml += \`
                <div class="msg-row \${role}">
                  <span class="msg-role">\${escapeHtml(m.role)}</span>
                  <span class="msg-text">\${escapeHtml(contentText)}</span>
                </div>
              \`;
            });
          }
        }
        messagesHtml += '</div>';

        cardHtml += \`
          <span class="detail-label">Context messages</span>
          \${messagesHtml}
          <span class="detail-label">Generated response</span>
          <div class="code-block">\${jsonText(ev.output)}</div>
          \${ev.usage ? \`
            <div class="usage-row">
              <span>Input tokens <strong>\${escapeHtml(ev.usage.input ?? 0)}</strong></span>
              <span>Output tokens <strong>\${escapeHtml(ev.usage.output ?? 0)}</strong></span>
              <span>Total tokens <strong>\${escapeHtml(ev.usage.totalTokens ?? 0)}</strong></span>
              <span>Cost <strong>\$\${escapeHtml(ev.usage.cost?.total?.toFixed?.(5) || "0.00")}</strong></span>
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
      card?.classList.toggle("expanded");
    }
  </script>
</body>
</html>`;
}
