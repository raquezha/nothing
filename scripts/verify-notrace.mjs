#!/usr/bin/env node
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import notrace from "../packages/notrace/dist/notrace.js";

const handlers = new Map();
const pi = {
  on(event, handler) {
    handlers.set(event, handler);
  },
};

notrace(pi);

const cwd = mkdtempSync(join(tmpdir(), "notrace-smoke-"));
const ctx = {
  cwd,
  sessionManager: {
    getSessionId: () => "notrace-smoke-session",
    getSessionFile: () => join(cwd, "session.jsonl"),
  },
};

async function emit(event, payload) {
  const handler = handlers.get(event);
  if (!handler) throw new Error(`Missing notrace handler for ${event}`);
  await handler(payload, ctx);
}

await emit("session_start", { reason: "smoke-test" });
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

const reportPath = join(cwd, ".workflow", "notrace.html");
if (!existsSync(reportPath)) {
  throw new Error(`Expected notrace report at ${reportPath}`);
}

const html = readFileSync(reportPath, "utf8");
if (!html.includes("<html") || !html.includes("notrace") || !html.includes("notrace-smoke-session")) {
  throw new Error("Generated notrace report is missing expected HTML markers.");
}

console.log(`notrace smoke ✓ ${reportPath}`);
