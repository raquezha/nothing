import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { handleSessionShutdown, type SessionShutdownDeps } from "../index.js";
import { cleanupTempNotraceDir, makeTempNotraceDir } from "./helpers.js";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { extractCorrelation, extractNochestraTelemetry, ActiveWorkflowAdapter } from "../adapters.js";

describe("Nochestra Correlation Integration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NOCHESTRA_RUN_ID;
    delete process.env.NOCHESTRA_WORK_ITEM_ID;
    delete process.env.NOCHESTRA_WORKER_ID;
    delete process.env.NOCHESTRA_SESSION_ID;
    delete process.env.NOCHESTRA_EPOCH_ID;
    delete process.env.NOCHESTRA_PARENT_SESSION_ID;
    delete process.env.NOCHESTRA_PARENT_PROMPT_TOKENS;
    delete process.env.NOCHESTRA_PARENT_CONTEXT_TOKENS;
    delete process.env.NOCHESTRA_BOUNDED_HANDOFF_TOKENS;
    delete process.env.NOCHESTRA_QUARANTINE_SAVINGS_TOKENS;
    delete process.env.NOCHESTRA_QUARANTINE_SAVINGS_PERCENT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("extracts correlation identifiers from environment variables when present", () => {
    process.env.NOCHESTRA_RUN_ID = "run-99";
    process.env.NOCHESTRA_WORKER_ID = "worker-2";
    process.env.NOCHESTRA_PARENT_SESSION_ID = "parent-session-9";

    const corr = extractCorrelation();
    expect(corr).toEqual({
      runId: "run-99",
      workerId: "worker-2",
      parentSessionId: "parent-session-9",
    });
  });

  it("returns null when no correlation identifiers exist in env or pointer", () => {
    const corr = extractCorrelation({});
    expect(corr).toBeNull();
  });

  it("captures correlation in run record and index when identifiers are present", async () => {
    process.env.NOCHESTRA_RUN_ID = "run-101";
    process.env.NOCHESTRA_EPOCH_ID = "epoch-1";
    process.env.NOCHESTRA_PARENT_SESSION_ID = "parent-session-11";

    const notraceDir = makeTempNotraceDir();
    const sessionId = "corr-session-1";

    const deps: SessionShutdownDeps = {
      events: [
        {
          type: "llm_completion",
          model: "claude-3-5-sonnet",
          provider: "anthropic",
          timestamp: 1000,
          usage: { inputTokens: 100, outputTokens: 50 },
        },
      ],
      startTime: 1000,
      traceId: sessionId,
      extensionTelemetry: new Map(),
      captureMode: "metadata",
      notraceDir,
      adapter: new ActiveWorkflowAdapter(),
    };

    const ctx = {
      cwd: process.cwd(),
      sessionManager: { getSessionId: () => sessionId },
    };

    await handleSessionShutdown({ reason: "normal" }, ctx, deps);

    const recordPath = path.join(notraceDir, "sessions", sessionId, "notrace.json");
    expect(existsSync(recordPath)).toBe(true);

    const record = JSON.parse(readFileSync(recordPath, "utf-8"));
    expect(record.correlation).toEqual({
      runId: "run-101",
      epochId: "epoch-1",
      parentSessionId: "parent-session-11",
    });

    const indexPath = path.join(notraceDir, "index.json");
    const indexData = JSON.parse(readFileSync(indexPath, "utf-8"));
    const sessionEntry = indexData.sessions.find((s: any) => s.sessionId === sessionId);
    expect(sessionEntry.correlation).toEqual({
      runId: "run-101",
      epochId: "epoch-1",
      parentSessionId: "parent-session-11",
    });

    cleanupTempNotraceDir(notraceDir);
  });

  it("extracts Nochestra context quarantine savings telemetry from environment variables", () => {
    process.env.NOCHESTRA_PARENT_PROMPT_TOKENS = "10000";
    process.env.NOCHESTRA_BOUNDED_HANDOFF_TOKENS = "2000";
    process.env.NOCHESTRA_QUARANTINE_SAVINGS_TOKENS = "8000";
    process.env.NOCHESTRA_QUARANTINE_SAVINGS_PERCENT = "80";

    const telemetry = extractNochestraTelemetry();
    expect(telemetry).toEqual({
      quarantineSavings: {
        parentPromptTokens: 10000,
        boundedHandoffTokens: 2000,
        quarantineSavingsTokens: 8000,
        quarantineSavingsPercent: 80,
      },
    });
  });
});
