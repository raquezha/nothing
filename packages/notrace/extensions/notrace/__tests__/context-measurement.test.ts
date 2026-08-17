import { describe, expect, it } from "vitest";
import { handleSessionShutdown, type SessionShutdownDeps } from "../index.js";
import { cleanupTempNotraceDir, makeTempNotraceDir } from "./helpers.js";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

describe("Context measurement & role marker integration", () => {
  it("records activeTokens, peakTokens, contextWindow, and messageCount in activity.context", async () => {
    const notraceDir = makeTempNotraceDir();
    const sessionId = "ctx-session-1";

    const deps: SessionShutdownDeps = {
      events: [
        { type: "turn_start", timestamp: 1000 },
        { type: "message_start", timestamp: 1001 },
        { type: "message_end", timestamp: 1002 },
        {
          type: "llm_completion",
          model: "claude-3-5-sonnet-20241022",
          provider: "anthropic",
          timestamp: 1003,
          usage: { inputTokens: 1200, outputTokens: 300, cacheReadTokens: 500, cacheWriteTokens: 100 },
        },
      ],
      startTime: 1000,
      traceId: sessionId,
      extensionTelemetry: new Map(),
      captureMode: "metadata",
      notraceDir,
      adapter: {
        name: "test",
        detect: () => true,
        getContext: () => ({ workflow: "rpiv", taskId: "task-77", taskPath: null, taskDir: null, role: "worker" }),
        attach: () => {},
      },
      contextSnapshot: {
        activeTokens: 2100,
        peakTokens: 2500,
        contextWindow: 200000,
        messageCount: 2,
      },
    };

    const ctx = {
      cwd: process.cwd(),
      sessionManager: { getSessionId: () => sessionId },
    };

    await handleSessionShutdown({ reason: "normal" }, ctx, deps);

    const recordPath = path.join(notraceDir, "sessions", sessionId, "notrace.json");
    expect(existsSync(recordPath)).toBe(true);

    const record = JSON.parse(readFileSync(recordPath, "utf-8"));
    expect(record.activity.context).toEqual({
      activeTokens: 2100,
      peakTokens: 2500,
      contextWindow: 200000,
      messageCount: 2,
    });
    expect(record.session.role).toBe("worker");
    expect(record.task.role).toBe("worker");
    expect(record.captureMode).toBe("metadata");

    cleanupTempNotraceDir(notraceDir);
  });

  it("represents missing provider fields as null rather than invented zeros", async () => {
    const notraceDir = makeTempNotraceDir();
    const sessionId = "ctx-session-2";

    const deps: SessionShutdownDeps = {
      events: [
        {
          type: "llm_completion",
          model: "local-llama",
          provider: "ollama",
          timestamp: 1000,
          usage: { inputTokens: 50, outputTokens: 20 },
        },
      ],
      startTime: 1000,
      traceId: sessionId,
      extensionTelemetry: new Map(),
      captureMode: "redacted",
      notraceDir,
      adapter: {
        name: "test",
        detect: () => true,
        getContext: () => ({ workflow: "generic", taskId: null, taskPath: null, taskDir: null, role: "parent" }),
        attach: () => {},
      },
      contextSnapshot: {
        activeTokens: null,
        peakTokens: null,
        contextWindow: null,
        messageCount: null,
      },
    };

    const ctx = {
      cwd: process.cwd(),
      sessionManager: { getSessionId: () => sessionId },
    };

    await handleSessionShutdown({ reason: "normal" }, ctx, deps);

    const recordPath = path.join(notraceDir, "sessions", sessionId, "notrace.json");
    const record = JSON.parse(readFileSync(recordPath, "utf-8"));

    expect(record.activity.context).toEqual({
      activeTokens: null,
      peakTokens: null,
      contextWindow: null,
      messageCount: null,
    });
    expect(record.session.role).toBe("parent");
    expect(record.task.role).toBe("parent");

    cleanupTempNotraceDir(notraceDir);
  });
});
