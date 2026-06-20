import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, chmodSync } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";
import type {
  NotraceActivity,
  NotraceCaptureMode,
  NotraceConditions,
  NotraceEvent,
  NotraceExtensionTelemetry,
  NotraceRunRecord,
  WorkflowContext,
} from "./types.js";
import { getActiveAdapter } from "./adapters.js";
import { generateHtmlReport, generateDashboardHtml } from "./renderer.js";

const REDACTED = "[REDACTED by notrace]";
const SENSITIVE_VALUE_RE = /(bearer\s+[a-z0-9._~+/=-]{12,}|sk-[a-z0-9_-]{16,}|gh[pousr]_[a-z0-9_]{16,}|AKIA[0-9A-Z]{16})/gi;
const TELEMETRY_CHANNEL = "notrace.telemetry.extension";
const SCHEMA_VERSION = 2;

type UsageLike = {
  input?: number;
  output?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheRead?: number;
  cacheWrite?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens?: number;
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
};

type ExtensionTelemetryPayload = {
  extension: string;
  loaded?: boolean;
  enabled?: boolean | null;
  active?: boolean | null;
  status?: string;
  summary?: string | null;
  details?: Record<string, unknown>;
};

let currentMode: NotraceCaptureMode = "full";

function getInitialMode(): NotraceCaptureMode {
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
  if (currentMode === "metadata") return { omitted: true, reason: "metadata-capture" };
  if (currentMode === "full") return value;
  if (value == null || typeof value !== "object") {
    return typeof value === "string" ? value.replace(SENSITIVE_VALUE_RE, REDACTED).slice(0, 10000) : value;
  }
  if (Array.isArray(value)) return value.slice(0, 100).map(sanitizeTraceValue);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value).slice(0, 100)) out[k] = isSensitiveKey(k) ? REDACTED : sanitizeTraceValue(v);
  return out;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeUsage(raw: unknown): Required<Pick<UsageLike, "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens" | "totalTokens">> & { totalCostUsd: number } {
  const usage = (raw && typeof raw === "object" ? raw : {}) as UsageLike;
  return {
    inputTokens: asNumber(usage.inputTokens ?? usage.input),
    outputTokens: asNumber(usage.outputTokens ?? usage.output),
    cacheReadTokens: asNumber(usage.cacheReadTokens ?? usage.cacheRead),
    cacheWriteTokens: asNumber(usage.cacheWriteTokens ?? usage.cacheWrite),
    totalTokens: asNumber(usage.totalTokens),
    totalCostUsd: asNumber(usage.cost?.total),
  };
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writePrivateFileAtomic(filePath: string, content: string): void {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, content, { encoding: "utf-8", mode: 0o600 });
  chmodSync(tmpPath, 0o600);
  renameSync(tmpPath, filePath);
}

function validateRunRecord(record: NotraceRunRecord): void {
  if (record.kind !== "notrace-run") throw new Error("notrace record validation failed: invalid kind");
  if (record.schemaVersion !== SCHEMA_VERSION) throw new Error("notrace record validation failed: invalid schemaVersion");
  if (!record.traceId || !record.session?.id) throw new Error("notrace record validation failed: missing session id");
  if (!record.repository?.cwd) throw new Error("notrace record validation failed: missing repository cwd");
  if (!record.activity?.totals) throw new Error("notrace record validation failed: missing activity totals");
  if (!Array.isArray(record.events)) throw new Error("notrace record validation failed: events must be an array");
}

function collectActivity(events: NotraceEvent[], startedAt: number, endedAt: number): NotraceActivity {
  const activity: NotraceActivity = {
    turnCount: 0,
    llmCallCount: 0,
    toolCallCount: 0,
    toolErrorCount: 0,
    durationMs: Math.max(0, endedAt - startedAt),
    totals: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
    },
  };

  for (const e of events) {
    if (e.type === "turn_start") activity.turnCount++;
    if (e.type === "tool_start") activity.toolCallCount++;
    if (e.type === "tool_end" && e.isError) activity.toolErrorCount++;
    if (e.type === "llm_completion") {
      activity.llmCallCount++;
      const usage = normalizeUsage(e.usage);
      activity.totals.inputTokens += usage.inputTokens;
      activity.totals.outputTokens += usage.outputTokens;
      activity.totals.cacheReadTokens += usage.cacheReadTokens;
      activity.totals.cacheWriteTokens += usage.cacheWriteTokens;
      activity.totals.totalTokens += usage.totalTokens;
      activity.totals.totalCostUsd += usage.totalCostUsd;
    }
  }

  return activity;
}

function buildConditions(events: NotraceEvent[], telemetry: Record<string, NotraceExtensionTelemetry>): NotraceConditions {
  const models = new Set<string>();
  const providers = new Set<string>();
  for (const event of events) {
    if (event.type !== "llm_completion") continue;
    if (typeof event.model === "string" && event.model) models.add(event.model);
    if (typeof event.provider === "string" && event.provider) providers.add(event.provider);
  }

  const extensions = ["notrace", ...Object.keys(telemetry).sort()];

  return {
    harness: {
      name: "pi",
      adapter: "pi-session-hooks",
      version: null,
    },
    models: [...models],
    providers: [...providers],
    extensions,
  };
}

function toTaskInfo(context: WorkflowContext | null): NotraceRunRecord["task"] {
  if (!context) return null;
  return {
    workflow: context.workflow,
    id: context.taskId,
    path: context.taskPath,
    dir: context.taskDir,
  };
}

function createIndexEntry(record: NotraceRunRecord, htmlPath: string, recordPath: string): Record<string, unknown> {
  return {
    sessionId: record.traceId,
    repositoryName: record.repository.name,
    startedAt: record.session.startedAt,
    endedAt: record.session.endedAt,
    captureMode: record.captureMode,
    task: record.task,
    conditions: record.conditions,
    activity: record.activity,
    artifacts: {
      html: htmlPath,
      record: recordPath,
    },
  };
}

function normalizeTelemetryPayload(raw: unknown): { extension: string; telemetry: NotraceExtensionTelemetry } | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as ExtensionTelemetryPayload;
  if (typeof payload.extension !== "string" || !payload.extension.trim()) return null;

  const status =
    payload.status === "absent" ||
    payload.status === "loaded-disabled" ||
    payload.status === "loaded-inactive" ||
    payload.status === "active" ||
    payload.status === "unknown"
      ? payload.status
      : "unknown";

  return {
    extension: payload.extension,
    telemetry: {
      loaded: payload.loaded !== false,
      enabled: typeof payload.enabled === "boolean" ? payload.enabled : null,
      active: typeof payload.active === "boolean" ? payload.active : null,
      status,
      summary: typeof payload.summary === "string" ? payload.summary : null,
      details: payload.details && typeof payload.details === "object" ? payload.details : {},
    },
  };
}

export default function (pi: ExtensionAPI) {
  const events: NotraceEvent[] = [];
  const startTime = Date.now();
  let traceId = "";
  let activeLlmPayload: unknown = null;
  let shutdownReason: string | null = null;
  const extensionTelemetry = new Map<string, NotraceExtensionTelemetry>();
  currentMode = getInitialMode();

  if (typeof pi.events?.on === "function") {
    pi.events.on(TELEMETRY_CHANNEL, (raw) => {
      const normalized = normalizeTelemetryPayload(raw);
      if (!normalized) return;
      extensionTelemetry.set(normalized.extension, normalized.telemetry);
    });
  }

  pi.registerCommand("notrace", {
    description: "Change notrace capture mode (full | redacted | metadata)",
    handler: async (args, ctx) => {
      const mode = args?.trim().toLowerCase();
      if (mode === "full" || mode === "redacted" || mode === "metadata") {
        currentMode = mode as NotraceCaptureMode;
        ctx.ui.notify(`notrace capture mode set to: ${currentMode}`, "info");
      } else {
        ctx.ui.notify(`Current notrace mode: ${currentMode}. Usage: /notrace [full|redacted|metadata]`, "info");
      }
    }
  });

  pi.on("session_start" as any, async (_e: any, ctx: any) => {
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
      events.push({
        type: "llm_completion",
        model: e.message.model,
        provider: e.message.provider,
        inputPayload: activeLlmPayload,
        outputContent: sanitizeTraceValue(e.message.content),
        usage: e.message.usage,
        stopReason: typeof e.message.stopReason === "string" ? e.message.stopReason : undefined,
        errorMessage: typeof e.message.errorMessage === "string" ? sanitizeTraceValue(e.message.errorMessage) : undefined,
        timestamp: Date.now(),
      });
      activeLlmPayload = null;
    }
  });

  pi.on("session_shutdown" as any, async (e: any, ctx: any) => {
    shutdownReason = typeof e?.reason === "string" ? e.reason : null;
    const endedAt = Date.now();
    const adapter = getActiveAdapter(ctx.cwd);
    const context = adapter.getContext(ctx.cwd);
    const notraceDir = process.env.NOTRACE_DIR || path.join(os.homedir(), ".notrace");
    const finalTraceId = ctx.sessionManager?.getSessionId?.() || traceId;
    const outputDir = path.join(notraceDir, "sessions", finalTraceId.replace(/[^a-z0-9]/gi, "-"));
    const repositoryName = path.basename(ctx.cwd);
    let branchName: string | null = null;
    try {
      branchName = execSync("git branch --show-current", { cwd: ctx.cwd, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).trim() || null;
    } catch {
      // not a git repo or no commits yet
    }
    const recordPath = path.join(outputDir, "notrace.json");

    let mergedEvents = events;
    let originalStartedAt = startTime;
    let originalTask: any = null;
    if (existsSync(recordPath)) {
      try {
        const oldRecord = readJsonFile<any>(recordPath, null);
        if (Array.isArray(oldRecord.events)) {
          mergedEvents = [...oldRecord.events, ...events];
        }
        if (oldRecord.session?.startedAt) {
          originalStartedAt = new Date(oldRecord.session.startedAt).getTime();
        }
        if (oldRecord.task) {
          originalTask = oldRecord.task;
        }
      } catch (err) {
        // ignore parse errors
      }
    }

    const activity = collectActivity(mergedEvents, originalStartedAt, endedAt);
    
    // Do not index purely empty ghost sessions
    const isGhostSession = activity.llmCallCount === 0 && activity.toolCallCount === 0 && activity.totals.totalTokens === 0;

    const telemetry = Object.fromEntries([...extensionTelemetry.entries()].sort(([a], [b]) => a.localeCompare(b)));

    const record: NotraceRunRecord = {
      kind: "notrace-run",
      schemaVersion: SCHEMA_VERSION,
      traceId: finalTraceId,
      repository: {
        name: repositoryName,
        cwd: ctx.cwd,
        branch: branchName,
      },
      session: {
        id: finalTraceId,
        startedAt: new Date(originalStartedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        durationMs: activity.durationMs,
        shutdownReason,
      },
      task: toTaskInfo(context) || originalTask,
      captureMode: currentMode,
      conditions: buildConditions(mergedEvents, telemetry),
      activity,
      telemetry: { extensions: telemetry },
      events: mergedEvents,
    };

    validateRunRecord(record);
    const html = generateHtmlReport(record);

    mkdirSync(outputDir, { recursive: true });
    const htmlPath = path.join(outputDir, "notrace.html");
    writePrivateFileAtomic(htmlPath, html);
    writePrivateFileAtomic(recordPath, `${JSON.stringify(record, null, 2)}\n`);

    const indexPath = path.join(notraceDir, "index.json");
    const existing = readJsonFile<any>(indexPath, { sessions: [] });
    let sessions = Array.isArray(existing.sessions) ? existing.sessions.filter((s: any) => s.sessionId !== finalTraceId) : [];
    
    if (!isGhostSession) {
      sessions.push(createIndexEntry(record, htmlPath, recordPath));
    }
    
    writePrivateFileAtomic(indexPath, `${JSON.stringify({ sessions }, null, 2)}\n`);
    writePrivateFileAtomic(path.join(notraceDir, "index.html"), generateDashboardHtml(sessions, {}));

    if (context) {
      const displayPath = htmlPath.startsWith(os.homedir()) 
        ? `~${htmlPath.slice(os.homedir().length)}` 
        : htmlPath;
      adapter.attach(context, {
        html: displayPath,
        record: recordPath
      });
    }

    console.log(`\n\x1b[1m\x1b[38;5;208m[notrace] Session Retrospective: file://${htmlPath}\x1b[0m\n`);
  });
}
