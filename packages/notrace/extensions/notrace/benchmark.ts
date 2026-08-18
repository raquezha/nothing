import { handleSessionShutdown, sanitizeTraceValue, type SessionShutdownDeps } from "./index.js";
import type { NotraceCaptureMode } from "./types.js";
import { makeTempNotraceDir, cleanupTempNotraceDir } from "./__tests__/helpers.js";
import { readFileSync, statSync } from "node:fs";
import * as path from "node:path";

function buildLongSessionEvents(count: number, mode: NotraceCaptureMode): any[] {
  const events: any[] = [];
  events.push({ type: "session_start", timestamp: 1000 });

  for (let i = 0; i < count; i++) {
    events.push({ type: "turn_start", timestamp: 1000 + i * 100 });
    events.push({
      type: "tool_start",
      toolName: "read",
      args: sanitizeTraceValue({ path: `src/file_${i}.ts`, limit: 50, offset: 0, contentSample: "const x = " + "a".repeat(300) }, mode),
      timestamp: 1001 + i * 100,
    });
    events.push({
      type: "tool_end",
      toolName: "read",
      result: sanitizeTraceValue({ content: "Sample content line 1\n" + "b".repeat(600) + "\nLine 20" }, mode),
      isError: false,
      timestamp: 1002 + i * 100,
    });
    events.push({
      type: "llm_completion",
      model: "claude-3-5-sonnet-20241022",
      provider: "anthropic",
      inputPayload: sanitizeTraceValue({
        authorization: ["Bearer", "1234567890abcdef1234567890"].join(" "),
        apiKey: "sensitive-api-key-value",
        messages: Array.from({ length: 15 }, (_, idx) => ({
          role: idx % 2 === 0 ? "user" : "assistant",
          content: `Turn ${i} message ${idx}: ` + "c".repeat(500),
        })),
        tools: [{ name: "read", description: "Read file contents" }],
      }, mode),
      outputContent: sanitizeTraceValue("Assistant response for turn " + i + ": " + "d".repeat(200), mode),
      usage: { inputTokens: 5000 + i * 100, outputTokens: 300, cacheReadTokens: 1000, cacheWriteTokens: 200 },
      timestamp: 1003 + i * 100,
    });
  }

  return events;
}

export async function runCaptureModeBenchmark(turns = 25): Promise<Record<string, { bytes: number; kb: string }>> {
  const modes = ["full", "redacted", "metadata"] as const;
  const results: Record<string, { bytes: number; kb: string }> = {};

  for (const mode of modes) {
    const notraceDir = makeTempNotraceDir();
    const sessionId = `bench-session-${mode}`;
    const events = buildLongSessionEvents(turns, mode);

    const deps: SessionShutdownDeps = {
      events,
      startTime: 1000,
      traceId: sessionId,
      extensionTelemetry: new Map(),
      captureMode: mode,
      notraceDir,
      adapter: {
        name: "benchmark",
        detect: () => true,
        getContext: () => ({ workflow: "rpiv", taskId: "github-75", taskPath: null, taskDir: null, role: "benchmark" }),
        attach: () => {},
      },
    };

    const ctx = {
      cwd: process.cwd(),
      sessionManager: { getSessionId: () => sessionId },
    };

    await handleSessionShutdown({ reason: "benchmark" }, ctx, deps);

    const recordPath = path.join(notraceDir, "sessions", sessionId, "notrace.json");
    const stat = statSync(recordPath);
    results[mode] = {
      bytes: stat.size,
      kb: (stat.size / 1024).toFixed(2) + " KB",
    };

    cleanupTempNotraceDir(notraceDir);
  }

  return results;
}
