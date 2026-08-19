import { describe, expect, it } from "vitest";
import { handleSessionShutdown, type SessionShutdownDeps } from "../index.js";
import { cleanupTempNotraceDir, makeTempNotraceDir } from "./helpers.js";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

describe("session report artifacts", () => {
  it("writes the canonical record and indexes it for dashboard links", async () => {
    const notraceDir = makeTempNotraceDir();
    const sessionId = "html-session-1";

    const deps: SessionShutdownDeps = {
      events: [
        {
          type: "llm_completion",
          model: "claude-3-5-sonnet",
          provider: "anthropic",
          timestamp: 1000,
          usage: { inputTokens: 10, outputTokens: 5 },
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
        getContext: () => null,
        attach: () => {},
      },
    };

    const ctx = {
      cwd: process.cwd(),
      sessionManager: { getSessionId: () => sessionId },
    };

    await handleSessionShutdown({ reason: "normal" }, ctx, deps);

    const reportPath = path.join(notraceDir, "sessions", sessionId, "notrace.html");
    expect(existsSync(reportPath)).toBe(false);

    const indexPath = path.join(notraceDir, "index.json");
    const indexData = JSON.parse(readFileSync(indexPath, "utf-8"));
    const sessionEntry = indexData.sessions.find((s: any) => s.sessionId === sessionId);
    expect(sessionEntry.artifacts.html).toBeUndefined();
    expect(sessionEntry.artifacts.record).toBe(`sessions/${sessionId}/notrace.json`);
    expect(existsSync(path.join(notraceDir, "index.html"))).toBe(true);

    cleanupTempNotraceDir(notraceDir);
  });
});
