import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, chmodSync, rmSync } from "node:fs";
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
import { extractCorrelation, getActiveAdapter, type WorkflowAdapter } from "./adapters.js";
import { generateDashboardHtml } from "./report-app/dashboard-report.js";
import { generateSessionSummaryHtml } from "./report-app/report.js";

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

let currentMode: NotraceCaptureMode = "redacted";

export function getInitialMode(envValue = process.env.NOTRACE_CAPTURE): NotraceCaptureMode {
  const env = envValue?.toLowerCase();
  if (env === "metadata" || env === "redacted" || env === "full") return env;
  return "redacted";
}

const SENSITIVE_KEY_RE = /(authorization|cookie|setcookie|password|passwd|pwd|secret|token|apikey|accesskey|accesskeyid|accessid|accesstoken|privatekey|session|credential|refreshtoken|idtoken)/i;

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "");
  if (/^(inputtokens|outputtokens|totaltokens|prompttokens|completiontokens|reasoningtokens|cachedtokens|cachecreationinputtokens|cachereadinputtokens|cost|total|input|output|prompt|completion|reasoning|read|write)$/i.test(normalized)) return false;
  return SENSITIVE_KEY_RE.test(normalized);
}

export function sanitizeTraceValue(value: unknown, mode: NotraceCaptureMode = currentMode): unknown {
  if (mode === "metadata") return { omitted: true, reason: "metadata-capture" };
  if (mode === "full") return value;
  if (value == null || typeof value !== "object") {
    return typeof value === "string" ? value.replace(SENSITIVE_VALUE_RE, REDACTED).slice(0, 10000) : value;
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeTraceValue(item, mode));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value).slice(0, 100)) out[k] = isSensitiveKey(k) ? REDACTED : sanitizeTraceValue(v, mode);
  return out;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function normalizeUsage(raw: unknown): Required<Pick<UsageLike, "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens" | "totalTokens">> & { totalCostUsd: number } {
  const usage = (raw && typeof raw === "object" ? raw : {}) as UsageLike;
  const inputTokens = asNumber(usage.inputTokens ?? usage.input);
  const outputTokens = asNumber(usage.outputTokens ?? usage.output);
  const cacheReadTokens = asNumber(usage.cacheReadTokens ?? usage.cacheRead);
  const cacheWriteTokens = asNumber(usage.cacheWriteTokens ?? usage.cacheWrite);
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens: usage.totalTokens == null ? inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens : asNumber(usage.totalTokens),
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

function collectActivity(
  events: NotraceEvent[],
  startedAt: number,
  endedAt: number,
  contextSnapshot?: ContextUsageSnapshot
): NotraceActivity {
  let messageCountFromEvents = 0;
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
    context: {
      activeTokens: contextSnapshot?.activeTokens ?? null,
      peakTokens: contextSnapshot?.peakTokens ?? null,
      contextWindow: contextSnapshot?.contextWindow ?? null,
      messageCount: contextSnapshot?.messageCount ?? null,
    },
  };

  for (const e of events) {
    if (e.type === "turn_start") activity.turnCount++;
    if (e.type === "tool_start") activity.toolCallCount++;
    if (e.type === "tool_end" && e.isError) activity.toolErrorCount++;
    if (e.type === "message_start" || e.type === "message_end") messageCountFromEvents++;
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

  if (activity.context.messageCount == null && messageCountFromEvents > 0) {
    activity.context.messageCount = messageCountFromEvents;
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
    role: context.role ?? process.env.NOCHESTRA_ROLE ?? process.env.PI_ROLE ?? null,
  };
}

function relativeArtifactPath(notraceDir: string, filePath: string): string {
  return path.relative(notraceDir, filePath).split(path.sep).join("/");
}

function createIndexEntry(record: NotraceRunRecord, recordPath: string, htmlPath: string, notraceDir: string): Record<string, unknown> {
  return {
    sessionId: record.traceId,
    repositoryName: record.repository.name,
    startedAt: record.session.startedAt,
    endedAt: record.session.endedAt,
    captureMode: record.captureMode,
    task: record.task,
    correlation: record.correlation ?? null,
    conditions: record.conditions,
    activity: record.activity,
    artifacts: {
      html: relativeArtifactPath(notraceDir, htmlPath),
      record: relativeArtifactPath(notraceDir, recordPath),
    },
  };
}

export type ContextUsageSnapshot = {
  activeTokens?: number | null;
  peakTokens?: number | null;
  contextWindow?: number | null;
  messageCount?: number | null;
};

export type SessionShutdownDeps = {
  events: NotraceEvent[];
  startTime: number;
  traceId: string;
  extensionTelemetry: Map<string, NotraceExtensionTelemetry>;
  captureMode: NotraceCaptureMode;
  notraceDir: string;
  adapter: WorkflowAdapter;
  contextSnapshot?: ContextUsageSnapshot;
};

export async function handleSessionShutdown(e: any, ctx: any, deps: SessionShutdownDeps): Promise<void> {
  const shutdownReason = typeof e?.reason === "string" ? e.reason : null;
  const endedAt = Date.now();
  const context = deps.adapter.getContext(ctx.cwd);
  const finalTraceId = ctx.sessionManager?.getSessionId?.() || deps.traceId;
  const outputDir = path.join(deps.notraceDir, "sessions", finalTraceId.replace(/[^a-z0-9]/gi, "-"));
  const repositoryName = path.basename(ctx.cwd);
  let branchName: string | null = null;
  try {
    branchName = execSync("git branch --show-current", { cwd: ctx.cwd, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8", timeout: 1000 }).trim() || null;
  } catch {
    // not a git repo or no commits yet
  }
  const recordPath = path.join(outputDir, "notrace.json");
  const reportPath = path.join(outputDir, "notrace.html");

  let mergedEvents = deps.events;
  let originalStartedAt = deps.startTime;
  let originalTask: any = null;
  if (existsSync(recordPath)) {
    try {
      const oldRecord = readJsonFile<any>(recordPath, null);
      if (Array.isArray(oldRecord.events)) {
        mergedEvents = [...oldRecord.events, ...deps.events];
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

  const activity = collectActivity(mergedEvents, originalStartedAt, endedAt, deps.contextSnapshot);
  
  // Do not index purely empty ghost sessions
  const isGhostSession = activity.llmCallCount === 0 && activity.toolCallCount === 0 && activity.totals.totalTokens === 0;

  const telemetry = Object.fromEntries([...deps.extensionTelemetry.entries()].sort(([a], [b]) => a.localeCompare(b)));
  const role = context?.role ?? process.env.NOCHESTRA_ROLE ?? process.env.PI_ROLE ?? null;
  const correlation = context?.correlation ?? extractCorrelation();

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
      role,
    },
    task: toTaskInfo(context) || originalTask,
    correlation: correlation ?? null,
    captureMode: deps.captureMode,
    conditions: buildConditions(mergedEvents, telemetry),
    activity,
    telemetry: { extensions: telemetry },
    events: mergedEvents,
  };

  validateRunRecord(record);

  if (!isGhostSession) {
    mkdirSync(outputDir, { recursive: true });
    writePrivateFileAtomic(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    const reportHtml = generateSessionSummaryHtml({ ...record, navigation: { indexHref: "../../index.html", recordHref: "notrace.json", viewerHref: `../../index.html?session=${encodeURIComponent(finalTraceId)}` } });
    writePrivateFileAtomic(reportPath, reportHtml);
  }

  const indexPath = path.join(deps.notraceDir, "index.json");
  const lockPath = `${indexPath}.lock`;
  let lockAcquired = false;
  for (let i = 0; i < 20; i++) {
    try {
      writeFileSync(lockPath, `${process.pid}`, { flag: "wx" });
      lockAcquired = true;
      break;
    } catch {
      const t = Date.now(); while (Date.now() - t < 50) {} // busy wait 50ms
    }
  }

  if (!lockAcquired) {
    // Could not get exclusive access to the index after retrying. Skip the
    // index/dashboard update rather than racing another process's
    // read-modify-write on index.json. The per-session record and HTML
    // report were already written above and are not affected.
    console.warn(`[notrace] Could not acquire index lock, skipping index update for ${finalTraceId}`);
  } else {
    try {
      const existing = readJsonFile<any>(indexPath, { sessions: [] });
      let sessions = Array.isArray(existing.sessions) ? existing.sessions.filter((s: any) => s.sessionId !== finalTraceId) : [];

      if (!isGhostSession) {
        sessions.push(createIndexEntry(record, recordPath, reportPath, deps.notraceDir));
      }

      writePrivateFileAtomic(indexPath, `${JSON.stringify({ sessions }, null, 2)}\n`);
      writePrivateFileAtomic(path.join(deps.notraceDir, "index.html"), generateDashboardHtml(sessions, {}));
    } finally {
      if (existsSync(lockPath)) {
        try { rmSync(lockPath); } catch {}
      }
    }
  }

  if (context && !isGhostSession) {
    const displayPath = reportPath.startsWith(os.homedir()) 
      ? `~${reportPath.slice(os.homedir().length)}` 
      : reportPath;
    deps.adapter.attach(context, {
      html: displayPath,
      record: recordPath
    });
  }

  if (!isGhostSession) {
    console.log(`\n\x1b[1m\x1b[38;5;208m[notrace] Session Retrospective: file://${reportPath}\x1b[0m\n`);
  }
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
  let activeTokens: number | null = null;
  let peakTokens: number | null = null;
  let contextWindow: number | null = null;
  let messageCount = 0;

  function updateContextUsage(ctx: any) {
    if (typeof ctx?.getContextUsage === 'function') {
      try {
        const u = ctx.getContextUsage();
        if (u && typeof u.tokens === 'number') {
          activeTokens = u.tokens;
          if (peakTokens === null || u.tokens > peakTokens) {
            peakTokens = u.tokens;
          }
        }
        if (u && typeof u.contextWindow === 'number') {
          contextWindow = u.contextWindow;
        }
      } catch {}
    }
  }
  const events: NotraceEvent[] = [];
  const startTime = Date.now();
  let traceId = "";
  let activeLlmPayload: unknown = null;
  const extensionTelemetry = new Map<string, NotraceExtensionTelemetry>();
  currentMode = getInitialMode();

  if (typeof pi.events?.on === "function") {
    pi.events.on(TELEMETRY_CHANNEL, (raw) => {
      const normalized = normalizeTelemetryPayload(raw);
      if (!normalized) return;
      extensionTelemetry.set(normalized.extension, normalized.telemetry);
    });

    pi.events.on("notrace.boundary", (e: any) => {
      recordBoundaryEvent(e);
    });
  }

  function recordBoundaryEvent(e: any, ctx?: any) {
    const type = typeof e?.type === "string" ? e.type : "epoch_boundary";
    const ev: Record<string, unknown> = {
      type,
      timestamp: typeof e?.timestamp === "number" ? e.timestamp : Date.now(),
    };
    if (e?.epochId != null) ev.epochId = String(e.epochId);
    if (e?.workerId != null) ev.workerId = String(e.workerId);
    if (e?.reason != null) ev.reason = String(e.reason);
    if (typeof e?.tokensBefore === "number") ev.tokensBefore = e.tokensBefore;
    if (typeof e?.tokensAfter === "number") ev.tokensAfter = e.tokensAfter;
    events.push(ev as NotraceEvent);
    if (ctx) updateContextUsage(ctx);
  }

  const boundaryTypes = ["epoch_start", "epoch_end", "compaction_start", "compaction_completion", "worker_handoff"];
  for (const bType of boundaryTypes) {
    pi.on(bType as any, async (e: any, ctx: any) => {
      recordBoundaryEvent({ ...e, type: bType }, ctx);
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
    updateContextUsage(ctx);
  });

  pi.on("turn_start" as any, async (_e: any, ctx: any) => {
    events.push({ type: "turn_start", timestamp: Date.now() });
    updateContextUsage(ctx);
  });

  pi.on("tool_execution_start" as any, async (e: any) => {
    events.push({ type: "tool_start", toolName: e.toolName, args: sanitizeTraceValue(e.args), timestamp: Date.now() });
  });

  pi.on("tool_execution_end" as any, async (e: any) => {
    events.push({ type: "tool_end", toolName: e.toolName, result: sanitizeTraceValue(e.result), isError: e.isError, timestamp: Date.now() });
  });

  pi.on("before_provider_request" as any, async (e: any) => {
    activeLlmPayload = sanitizeTraceValue(e.payload);
  });

  pi.on("message_end" as any, async (e: any, ctx: any) => {
    messageCount++;
    updateContextUsage(ctx);
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
    updateContextUsage(ctx);
    await handleSessionShutdown(e, ctx, {
      contextSnapshot: {
        activeTokens,
        peakTokens,
        contextWindow,
        messageCount: messageCount > 0 ? messageCount : null,
      },
      events,
      startTime,
      traceId,
      extensionTelemetry,
      captureMode: currentMode,
      notraceDir: process.env.NOTRACE_DIR || path.join(os.homedir(), ".notrace"),
      adapter: getActiveAdapter(ctx.cwd),
    });
  });
}
