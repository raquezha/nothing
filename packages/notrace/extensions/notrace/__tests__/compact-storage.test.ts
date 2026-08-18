import { describe, expect, it } from "vitest";
import { generateHtmlReport } from "../report-app/report.js";
import { handleSessionShutdown, type SessionShutdownDeps } from "../index.js";
import { cleanupTempNotraceDir, makeTempNotraceDir } from "./helpers.js";
import { existsSync, readFileSync, statSync } from "node:fs";
import * as path from "node:path";

describe("Compact Storage & Viewer Shell Integration", () => {
  const sampleEvents = Array.from({ length: 20 }, (_, i) => ({
    type: "llm_completion",
    model: "claude-3-5-sonnet-20241022",
    provider: "anthropic",
    timestamp: 1000 + i * 10,
    inputPayload: {
      messages: [
        { role: "user", content: `Sample prompt turn ${i} with long description context line to simulate realistic payload size.` },
      ],
    },
    outputContent: `Sample assistant response text for turn ${i} returning structured detailed markdown explanation.`,
    usage: { inputTokens: 1200 + i * 10, outputTokens: 300 },
  }));

  it("produces a compact HTML report relying on canonical notrace.json JSON stream", async () => {
    const notraceDir = makeTempNotraceDir();
    const sessionId = "compact-session-1";

    const deps: SessionShutdownDeps = {
      events: sampleEvents,
      startTime: 1000,
      traceId: sessionId,
      extensionTelemetry: new Map(),
      captureMode: "full",
      notraceDir,
      adapter: {
        name: "test",
        detect: () => true,
        getContext: () => ({ workflow: "rpiv", taskId: "github-81", taskPath: null, taskDir: null }),
        attach: () => {},
      },
      contextSnapshot: {
        activeTokens: 1500,
        peakTokens: 3000,
        contextWindow: 200000,
        messageCount: 20,
      },
    };

    const ctx = {
      cwd: process.cwd(),
      sessionManager: { getSessionId: () => sessionId },
    };

    delete process.env.NOTRACE_STANDALONE_HTML;
    await handleSessionShutdown({ reason: "normal" }, ctx, deps);

    const recordPath = path.join(notraceDir, "sessions", sessionId, "notrace.json");
    const htmlPath = path.join(notraceDir, "sessions", sessionId, "notrace.html");

    expect(existsSync(recordPath)).toBe(true);
    expect(existsSync(htmlPath)).toBe(true);

    const record = JSON.parse(readFileSync(recordPath, "utf-8"));
    expect(record.events.length).toBe(20);

    const htmlCompact = readFileSync(htmlPath, "utf-8");
    expect(htmlCompact).toContain('data-lazy-event-index="0"');
    expect(htmlCompact).toContain('id="notrace-data"');
    expect(htmlCompact).not.toContain("data-lazy-event-body=");

    const compactSize = statSync(htmlPath).size;

    // Standalone generation test
    const standaloneHtml = generateHtmlReport(record, { standalone: true });
    expect(standaloneHtml).toContain("data-lazy-event-body=");
    expect(standaloneHtml.length).toBeGreaterThan(compactSize);

    cleanupTempNotraceDir(notraceDir);
  });

  it("respects NOTRACE_STANDALONE_HTML environment flag for legacy standalone mode", async () => {
    const notraceDir = makeTempNotraceDir();
    const sessionId = "compact-session-2";

    const deps: SessionShutdownDeps = {
      events: sampleEvents.slice(0, 5),
      startTime: 1000,
      traceId: sessionId,
      extensionTelemetry: new Map(),
      captureMode: "full",
      notraceDir,
      adapter: {
        name: "test",
        detect: () => true,
        getContext: () => ({ workflow: "rpiv", taskId: "github-81", taskPath: null, taskDir: null }),
        attach: () => {},
      },
    };

    const ctx = {
      cwd: process.cwd(),
      sessionManager: { getSessionId: () => sessionId },
    };

    process.env.NOTRACE_STANDALONE_HTML = "true";
    await handleSessionShutdown({ reason: "normal" }, ctx, deps);
    delete process.env.NOTRACE_STANDALONE_HTML;

    const htmlPath = path.join(notraceDir, "sessions", sessionId, "notrace.html");
    const html = readFileSync(htmlPath, "utf-8");
    expect(html).toContain("data-lazy-event-body=");

    cleanupTempNotraceDir(notraceDir);
  });
});
