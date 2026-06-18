#!/usr/bin/env node
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import notrace from "../packages/notrace/dist/notrace/index.js";

function createEventBus() {
  const listeners = new Map();
  return {
    emit(channel, data) {
      for (const handler of listeners.get(channel) || []) handler(data);
    },
    on(channel, handler) {
      const current = listeners.get(channel) || [];
      current.push(handler);
      listeners.set(channel, current);
      return () => listeners.set(channel, (listeners.get(channel) || []).filter((entry) => entry !== handler));
    },
  };
}

async function runSession({ cwd, withActiveTask, captureMode = "full" }) {
  const previousCapture = process.env.NOTRACE_CAPTURE;
  process.env.NOTRACE_CAPTURE = captureMode;
  const handlers = new Map();
  const pi = {
    events: createEventBus(),
    on(event, handler) {
      handlers.set(event, handler);
    },
    registerCommand() {
      // no-op for smoke verification
    },
  };

  notrace(pi);
  let taskDir = null;
  let workPath = null;

  if (withActiveTask) {
    taskDir = join(cwd, ".workflow", "tasks", "local-smoke");
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(join(cwd, ".workflow", "active_task.json"), JSON.stringify({
      active_task: "local-smoke",
      taskPath: ".workflow/tasks/local-smoke"
    }, null, 2));
    workPath = join(taskDir, "WORK.md");
    writeFileSync(workPath, `# WORK: Local smoke\n\n## [LOG]\n- seed entry\n`);
  }

  const ctx = {
    cwd,
    sessionManager: {
      getSessionId: () => withActiveTask ? "notrace-task-session" : "notrace-plain-session",
      getSessionFile: () => join(cwd, "session.jsonl"),
    },
  };

  async function emit(event, payload) {
    const handler = handlers.get(event);
    if (!handler) throw new Error(`Missing notrace handler for ${event}`);
    await handler(payload, ctx);
  }

  pi.events.emit("notrace.telemetry.extension", {
    extension: "noheadroom",
    loaded: true,
    enabled: true,
    active: true,
    status: "active",
    summary: "compressed 15 to 10 tokens; saved 5 tokens across 1 tool results",
    details: {
      attempts: 1,
      applied: 1,
      guardSkips: 0,
      tokensSaved: 5,
    },
  });

  await emit("session_start", { reason: withActiveTask ? "task-smoke" : "plain-smoke" });
  await emit("turn_start", {});
  await emit("tool_execution_start", {
    toolCallId: "tool-1",
    toolName: "read",
    args: { path: "README.md", authorization: "demo auth value" },
  });
  await emit("tool_execution_end", {
    toolCallId: "tool-1",
    toolName: "read",
    result: { content: "hello", token: "demo token value" },
    isError: false,
  });
  await emit("message_end", {
    message: {
      role: "assistant",
      model: "smoke-model",
      provider: "smoke-provider",
      content: [{ type: "text", text: "hello" }],
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { total: 0.001 },
      },
    },
  });
  await emit("session_shutdown", { reason: "quit" });

  const outputDir = join(cwd, ".notrace", "sessions", withActiveTask ? "notrace-task-session" : "notrace-plain-session");
  const reportPath = join(outputDir, "notrace.html");
  const recordPath = join(outputDir, "notrace.json");
  const indexPath = join(cwd, ".notrace", "index.json");

  if (!existsSync(reportPath)) throw new Error(`Expected notrace report at ${reportPath}`);
  if (!existsSync(recordPath)) throw new Error(`Expected notrace record at ${recordPath}`);
  if (!existsSync(indexPath)) throw new Error(`Expected notrace index at ${indexPath}`);

  const html = readFileSync(reportPath, "utf8");
  const expectedSessionId = withActiveTask ? "notrace-task-session" : "notrace-plain-session";
  if (!html.includes("<html") || !html.includes("notrace") || !html.includes(expectedSessionId)) {
    throw new Error("Generated notrace report is missing expected HTML markers.");
  }

  const record = JSON.parse(readFileSync(recordPath, "utf8"));
  if (record.kind !== "notrace-run" || record.traceId !== expectedSessionId) {
    throw new Error("Generated notrace record is missing expected run markers.");
  }
  if (record.activity?.llmCallCount !== 1 || record.activity?.toolCallCount !== 1) {
    throw new Error("Generated notrace record is missing expected activity counts.");
  }
  if (record.activity?.totals?.inputTokens !== 10 || record.activity?.totals?.outputTokens !== 5) {
    throw new Error("Generated notrace record is missing normalized token totals.");
  }
  if (record.telemetry?.extensions?.noheadroom?.status !== "active") {
    throw new Error("Generated notrace record is missing extension telemetry.");
  }
  if (record.captureMode !== captureMode) {
    throw new Error(`Expected capture mode ${captureMode}, got ${record.captureMode}`);
  }
  const toolStart = record.events.find((event) => event.type === "tool_start");
  const toolEnd = record.events.find((event) => event.type === "tool_end");
  const serializedRecord = JSON.stringify(record);
  if (captureMode === "metadata") {
    if (!toolStart?.args?.omitted || !toolEnd?.result?.omitted) {
      throw new Error("Expected metadata mode to omit tool payload bodies.");
    }
    if (serializedRecord.includes("demo auth value") || serializedRecord.includes("demo token value")) {
      throw new Error("Expected metadata mode to omit sensitive payload values.");
    }
  }
  if (captureMode === "redacted") {
    if (toolStart?.args?.authorization !== "[REDACTED by notrace]" || toolEnd?.result?.token !== "[REDACTED by notrace]") {
      throw new Error("Expected redacted mode to redact sensitive payload values.");
    }
  }

  if (previousCapture === undefined) delete process.env.NOTRACE_CAPTURE;
  else process.env.NOTRACE_CAPTURE = previousCapture;

  if (withActiveTask) {
    const work = readFileSync(workPath, "utf8");
    if (!work.includes("notrace retrospective") || !work.includes(".notrace/sessions/notrace-task-session")) {
      throw new Error("Expected WORK.md log to include notrace artifact attachment.");
    }
  }

  return { reportPath, recordPath, workPath, indexPath };
}

const plainCwd = mkdtempSync(join(tmpdir(), "notrace-plain-"));
const plain = await runSession({ cwd: plainCwd, withActiveTask: false, captureMode: "full" });

const taskCwd = mkdtempSync(join(tmpdir(), "notrace-task-"));
const task = await runSession({ cwd: taskCwd, withActiveTask: true, captureMode: "redacted" });

const metadataCwd = mkdtempSync(join(tmpdir(), "notrace-metadata-"));
const metadata = await runSession({ cwd: metadataCwd, withActiveTask: false, captureMode: "metadata" });

console.log(`notrace smoke ✓ plain=${plain.reportPath} task=${task.reportPath} metadata=${metadata.reportPath} work=${task.workPath}`);
