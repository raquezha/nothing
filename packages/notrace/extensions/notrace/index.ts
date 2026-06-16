import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import * as path from "node:path";
import type { NotraceMetrics, NotraceEvent } from "./types.js";
import { getActiveAdapter } from "./adapters.js";
import { generateHtmlReport, generateDashboardHtml } from "./renderer.js";

const REDACTED = "[REDACTED by notrace]";
const SENSITIVE_VALUE_RE = /(bearer\s+[a-z0-9._~+/=-]{12,}|sk-[a-z0-9_-]{16,}|gh[pousr]_[a-z0-9_]{16,}|AKIA[0-9A-Z]{16})/gi;

type CaptureMode = "metadata" | "redacted" | "full";

let currentMode: CaptureMode = "full";

function getInitialMode(): CaptureMode {
  const env = process.env.NOTRACE_CAPTURE?.toLowerCase();
  if (env === "metadata" || env === "redacted") return env;
  return "full";
}

const SENSITIVE_KEY_RE = /(authorization|cookie|setcookie|password|passwd|pwd|secret|token|apikey|accesskey|accesskeyid|accessid|accesstoken|privatekey|session|credential|refreshtoken|idtoken)/i;

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "");
  if (/^(inputtokens|outputtokens|totaltokens|prompttokens|completiontokens|reasoningtokens|cachedtokens|cachecreationinputtokens|cachereadinputtokens|cost|total|input|output|prompt|completion|reasoning|read|write)$/i.test(normalized)) return false;
  return SENSITIVE_KEY_RE.test(normalized);
}

function sanitizeTraceValue(value: unknown): unknown {
  if (currentMode === "full") return value;
  if (value == null || typeof value !== "object") {
    return typeof value === "string" ? value.replace(SENSITIVE_VALUE_RE, REDACTED).slice(0, 10000) : value;
  }
  if (Array.isArray(value)) return value.slice(0, 100).map(sanitizeTraceValue);
  const out: any = {};
  for (const [k, v] of Object.entries(value).slice(0, 100)) out[k] = isSensitiveKey(k) ? REDACTED : sanitizeTraceValue(v);
  return out;
}

function collectMetrics(events: NotraceEvent[]): NotraceMetrics {
  let [tokens, cost, turns, tools, errors] = [0, 0, 0, 0, 0];
  for (const e of events) {
    if (e.type === "turn_start") turns++;
    if (e.type === "tool_start") tools++;
    if (e.type === "tool_end" && e.isError) errors++;
    if (e.type === "llm_completion" && e.usage) {
      tokens += (e.usage.totalTokens || 0);
      cost += (e.usage.cost?.total || 0);
    }
  }
  return { totalTokens: tokens, totalCost: cost, turnCount: turns, toolCallCount: tools, toolErrorCount: errors };
}

export default function (pi: ExtensionAPI) {
  const events: NotraceEvent[] = [];
  const startTime = Date.now();
  let traceId = "";
  let activeLlmPayload: any = null;
  currentMode = getInitialMode();

  pi.registerCommand("notrace", {
    description: "Change notrace capture mode (full | redacted | metadata)",
    handler: async (args, ctx) => {
      const mode = args?.trim().toLowerCase();
      if (mode === "full" || mode === "redacted" || mode === "metadata") {
        currentMode = mode as CaptureMode;
        ctx.ui.notify(`notrace capture mode set to: ${currentMode}`, "info");
      } else {
        ctx.ui.notify(`Current notrace mode: ${currentMode}. Usage: /notrace [full|redacted|metadata]`, "info");
      }
    }
  });

  pi.on("session_start" as any, async (e: any, ctx: any) => {
    traceId = ctx.sessionManager.getSessionId() || `s-${Date.now()}`;
    events.push({ type: "session_start", timestamp: Date.now() });
  });

  pi.on("turn_start" as any, async () => events.push({ type: "turn_start", timestamp: Date.now() }));

  pi.on("tool_execution_start" as any, async (e: any) => {
    events.push({ type: "tool_start", toolName: e.toolName, args: sanitizeTraceValue(e.args), timestamp: Date.now() });
  });

  pi.on("tool_execution_end" as any, async (e: any) => {
    events.push({ type: "tool_end", toolName: e.toolName, result: sanitizeTraceValue(e.result), isError: e.isError, timestamp: Date.now() });
  });

  pi.on("before_provider_request" as any, async (e: any) => {
    activeLlmPayload = sanitizeTraceValue(e.payload);
  });

  pi.on("message_end" as any, async (e: any) => {
    if (e.message.role === "assistant") {
      events.push({ type: "llm_completion", model: e.message.model, inputPayload: activeLlmPayload, outputContent: sanitizeTraceValue(e.message.content), usage: e.message.usage, timestamp: Date.now() });
      activeLlmPayload = null;
    }
  });

  pi.on("session_shutdown" as any, async (e: any, ctx: any) => {
    const adapter = getActiveAdapter(ctx.cwd);
    const context = adapter.getContext(ctx.cwd);
    const notraceDir = path.resolve(ctx.cwd, ".notrace");
    const outputDir = path.join(notraceDir, "sessions", traceId.replace(/[^a-z0-9]/gi, "-"));
    const metrics = collectMetrics(events);
    
    const html = generateHtmlReport({ traceId, startTime: new Date(startTime).toISOString(), metrics, events });
    const record = { traceId, metrics, events, context };

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(path.join(outputDir, "notrace.html"), html);
    writeFileSync(path.join(outputDir, "notrace.json"), JSON.stringify(record, null, 2));

    const indexPath = path.join(notraceDir, "index.json");
    const existing = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf-8")) : { sessions: [] };
    const sessions = existing.sessions.filter((s: any) => s.sessionId !== traceId);
    sessions.push({ sessionId: traceId, startedAt: new Date(startTime).toISOString(), workflow: context?.workflow, taskId: context?.taskId, artifacts: { html: path.relative(ctx.cwd, path.join(outputDir, "notrace.html")), record: path.relative(ctx.cwd, path.join(outputDir, "notrace.json")) } });
    writeFileSync(indexPath, JSON.stringify({ ...existing, sessions }, null, 2));
    writeFileSync(path.join(notraceDir, "index.html"), generateDashboardHtml(sessions));

    if (context) {
      adapter.attach(context, {
        html: path.relative(ctx.cwd, path.join(outputDir, "notrace.html")),
        record: path.relative(ctx.cwd, path.join(outputDir, "notrace.json"))
      });
    }

    console.log(`\n\x1b[1m\x1b[38;5;208m[notrace] Session Retrospective: file://${path.join(outputDir, "notrace.html")}\x1b[0m\n`);
  });
}
