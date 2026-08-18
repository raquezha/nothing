import { describe, expect, it } from "vitest";
import { handleSessionShutdown, type SessionShutdownDeps } from "../index.js";
import { cleanupTempNotraceDir, makeTempNotraceDir } from "./helpers.js";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

describe("Pi Compaction & Epoch Boundaries Integration", () => {
  it("records compaction and epoch boundary events with optional fields", async () => {
    const notraceDir = makeTempNotraceDir();
    const sessionId = "epoch-session-1";

    const deps: SessionShutdownDeps = {
      events: [
        { type: "epoch_start", epochId: "ep-001", timestamp: 1000 },
        {
          type: "compaction_start",
          epochId: "ep-001",
          reason: "context_window_80_percent",
          tokensBefore: 150000,
          timestamp: 1005,
        },
        {
          type: "compaction_completion",
          epochId: "ep-001",
          tokensBefore: 150000,
          tokensAfter: 35000,
          timestamp: 1010,
        },
        {
          type: "worker_handoff",
          workerId: "w-42",
          timestamp: 1015,
        },
        {
          type: "epoch_end",
          epochId: "ep-001",
          reason: "task_completed",
          timestamp: 1020,
        },
        {
          type: "llm_completion",
          model: "claude-3-5-sonnet-20241022",
          provider: "anthropic",
          timestamp: 1025,
          usage: { inputTokens: 500, outputTokens: 100 },
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
        getContext: () => ({ workflow: "rpiv", taskId: "github-80", taskPath: null, taskDir: null }),
        attach: () => {},
      },
      contextSnapshot: {
        activeTokens: 35000,
        peakTokens: 150000,
        contextWindow: 200000,
        messageCount: 10,
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

    const epochEvents = record.events.filter((e: any) =>
      ["epoch_start", "compaction_start", "compaction_completion", "worker_handoff", "epoch_end"].includes(e.type)
    );
    expect(epochEvents.length).toBe(5);

    const compStart = record.events.find((e: any) => e.type === "compaction_start");
    expect(compStart.epochId).toBe("ep-001");
    expect(compStart.reason).toBe("context_window_80_percent");
    expect(compStart.tokensBefore).toBe(150000);
    expect(compStart.tokensAfter).toBeUndefined();

    const handoff = record.events.find((e: any) => e.type === "worker_handoff");
    expect(handoff.workerId).toBe("w-42");

    expect(record.activity.context.peakTokens).toBe(150000);
    expect(record.activity.context.activeTokens).toBe(35000);

    const dashboardPath = path.join(notraceDir, "index.html");
    expect(existsSync(dashboardPath)).toBe(true);

    cleanupTempNotraceDir(notraceDir);
  });
});
