#!/usr/bin/env node
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import notrace from "../packages/notrace/dist/notrace/index.js";

async function runSession({ cwd, withActiveTask }) {
  const handlers = new Map();
  const pi = {
    on(event, handler) {
      handlers.set(event, handler);
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

  await emit("session_start", { reason: withActiveTask ? "task-smoke" : "plain-smoke" });
  await emit("turn_start", {});
  await emit("tool_execution_start", {
    toolCallId: "tool-1",
    toolName: "read",
    args: { path: "README.md" },
  });
  await emit("tool_execution_end", {
    toolCallId: "tool-1",
    toolName: "read",
    result: { content: "hello" },
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
        totalTokens: 15,
        cost: { total: 0.001 },
      },
    },
  });
  await emit("turn_end", {});
  await emit("session_shutdown", {});

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

  if (withActiveTask) {
    const work = readFileSync(workPath, "utf8");
    if (!work.includes("notrace captured artifacts") || !work.includes(".notrace/sessions/notrace-task-session")) {
      throw new Error("Expected WORK.md log to include notrace artifact attachment.");
    }
  }

  return { reportPath, recordPath, workPath, indexPath };
}

const plainCwd = mkdtempSync(join(tmpdir(), "notrace-plain-"));
const plain = await runSession({ cwd: plainCwd, withActiveTask: false });

const taskCwd = mkdtempSync(join(tmpdir(), "notrace-task-"));
const task = await runSession({ cwd: taskCwd, withActiveTask: true });

console.log(`notrace smoke ✓ plain=${plain.reportPath} task=${task.reportPath} work=${task.workPath}`);
