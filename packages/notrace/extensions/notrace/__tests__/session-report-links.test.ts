import { afterEach, describe, expect, it } from "vitest";
import { handleSessionShutdown, type SessionShutdownDeps } from "../index.js";
import { cleanupTempNotraceDir, makeTempNotraceDir } from "./helpers.js";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

afterEach(() => {
  delete process.env.NOTRACE_LEGACY_HTML;
});

describe("session report artifacts", () => {
  it("writes a compact per-session summary and indexes it for dashboard links", async () => {
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
    expect(existsSync(reportPath)).toBe(true);
    const reportHtml = readFileSync(reportPath, "utf-8");
    expect(reportHtml).toContain("Session summary");
    expect(reportHtml).not.toContain("Timeline");
    expect(reportHtml).toContain("Open canonical record");

    const indexPath = path.join(notraceDir, "index.json");
    const indexData = JSON.parse(readFileSync(indexPath, "utf-8"));
    const sessionEntry = indexData.sessions.find((s: any) => s.sessionId === sessionId);
    expect(sessionEntry.artifacts.html).toBe(`sessions/${sessionId}/notrace.html`);
    expect(sessionEntry.artifacts.record).toBe(`sessions/${sessionId}/notrace.json`);
    expect(existsSync(path.join(notraceDir, "index.html"))).toBe(true);

    cleanupTempNotraceDir(notraceDir);
  });

  it("keeps the full self-contained report behind an explicit compatibility option", async () => {
    process.env.NOTRACE_LEGACY_HTML = "1";
    const notraceDir = makeTempNotraceDir();
    const sessionId = "legacy-html-session";

    const deps: SessionShutdownDeps = {
      events: [
        {
          type: "llm_completion",
          model: "claude-3-5-sonnet",
          provider: "anthropic",
          timestamp: 1000,
          inputPayload: { messages: [{ role: "user", content: "hi" }] },
          outputContent: "hello",
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
    const reportHtml = readFileSync(reportPath, "utf-8");
    expect(reportHtml).toContain("Timeline");
    expect(reportHtml).toContain("Session retrospective");

    cleanupTempNotraceDir(notraceDir);
  });
});
