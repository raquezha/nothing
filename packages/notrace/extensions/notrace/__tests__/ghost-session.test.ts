import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleSessionShutdown, type SessionShutdownDeps } from "../index.js";
import { cleanupTempNotraceDir, makeTempNotraceDir } from "./helpers.js";

const tempDirs: string[] = [];

function makeCtx(sessionId: string) {
  return {
    cwd: process.cwd(),
    sessionManager: {
      getSessionId: () => sessionId,
    },
  };
}

function makeDeps(notraceDir: string, traceId: string, events: SessionShutdownDeps["events"], attach = vi.fn()): SessionShutdownDeps {
  return {
    events,
    startTime: Date.now() - 1000,
    traceId,
    extensionTelemetry: new Map(),
    captureMode: "full",
    notraceDir,
    adapter: {
      name: "test",
      detect: () => true,
      getContext: () => ({ workflow: "test", taskId: "task-1", taskPath: null, taskDir: null }),
      attach,
    },
  };
}

function sessionDir(notraceDir: string, sessionId: string): string {
  return path.join(notraceDir, "sessions", sessionId.replace(/[^a-z0-9]/gi, "-"));
}

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length) cleanupTempNotraceDir(tempDirs.pop()!);
});

describe("handleSessionShutdown ghost sessions", () => {
  it("skips session artifact writes, index entry creation, attach, and console log for ghost sessions", async () => {
    const notraceDir = makeTempNotraceDir();
    tempDirs.push(notraceDir);
    const sessionId = "ghost-session";
    const attach = vi.fn();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await handleSessionShutdown(
      { reason: "ghost" },
      makeCtx(sessionId),
      makeDeps(notraceDir, sessionId, [], attach),
    );

    const dir = sessionDir(notraceDir, sessionId);
    expect(existsSync(path.join(dir, "notrace.json"))).toBe(false);

    const indexPath = path.join(notraceDir, "index.json");
    if (existsSync(indexPath)) {
      const index = readJson(indexPath);
      expect(index.sessions.filter((session: { sessionId: string }) => session.sessionId === sessionId)).toHaveLength(0);
    } else {
      expect(existsSync(indexPath)).toBe(false);
    }

    expect(attach).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("still writes artifacts and indexes non-ghost sessions", async () => {
    const notraceDir = makeTempNotraceDir();
    tempDirs.push(notraceDir);
    const sessionId = "real-session";
    const attach = vi.fn();
    vi.spyOn(console, "log").mockImplementation(() => {});

    await handleSessionShutdown(
      { reason: "normal" },
      makeCtx(sessionId),
      makeDeps(notraceDir, sessionId, [
        { type: "tool_start", toolName: "test-tool", args: {}, timestamp: Date.now() },
      ], attach),
    );

    const dir = sessionDir(notraceDir, sessionId);
    const recordPath = path.join(dir, "notrace.json");
    expect(existsSync(recordPath)).toBe(true);

    const index = readJson(path.join(notraceDir, "index.json"));
    expect(index.sessions.some((session: { sessionId: string }) => session.sessionId === sessionId)).toBe(true);
    expect(attach).toHaveBeenCalledOnce();
  });
});
