import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleSessionShutdown, type SessionShutdownDeps } from "../index.js";
import { cleanupTempNotraceDir, makeTempNotraceDir } from "./helpers.js";

const tempDirs: string[] = [];

function makeDeps(notraceDir: string, traceId: string): SessionShutdownDeps {
  return {
    events: [{ type: "tool_start", toolName: "test-tool", args: {}, timestamp: Date.now() }],
    startTime: Date.now() - 1000,
    traceId,
    extensionTelemetry: new Map(),
    captureMode: "full",
    notraceDir,
    adapter: {
      name: "test",
      detect: () => true,
      getContext: () => null,
      attach: () => {},
    },
  };
}

function makeCtx(sessionId: string) {
  return {
    cwd: process.cwd(),
    sessionManager: {
      getSessionId: () => sessionId,
    },
  };
}

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function sessionDir(notraceDir: string, sessionId: string): string {
  return path.join(notraceDir, "sessions", sessionId.replace(/[^a-z0-9]/gi, "-"));
}

async function runWorker(sessionId: string, notraceDir: string): Promise<void> {
  const distIndexPath = path.resolve(process.cwd(), "dist/notrace/index.js");
  const workerScript = `
    import { parentPort, workerData } from "node:worker_threads";
    const { handleSessionShutdown } = await import(workerData.distIndexPath);
    const deps = {
      events: [{ type: "tool_start", toolName: "test-tool", args: {}, timestamp: Date.now() }],
      startTime: Date.now() - 1000,
      traceId: workerData.sessionId,
      extensionTelemetry: new Map(),
      captureMode: "full",
      notraceDir: workerData.notraceDir,
      adapter: { name: "test", detect: () => true, getContext: () => null, attach: () => {} },
    };
    const ctx = {
      cwd: workerData.cwd,
      sessionManager: { getSessionId: () => workerData.sessionId },
    };
    await handleSessionShutdown({ reason: "worker-test" }, ctx, deps);
    parentPort.postMessage("done");
  `;

  await new Promise<void>((resolve, reject) => {
    const worker = new Worker(workerScript, {
      eval: true,
      type: "module",
      workerData: { sessionId, notraceDir, cwd: process.cwd(), distIndexPath },
    });
    worker.once("message", () => resolve());
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`worker exited with code ${code}`));
    });
  });
}

if (!isMainThread) {
  const { sessionId, notraceDir } = workerData as { sessionId: string; notraceDir: string };
  await handleSessionShutdown({ reason: "worker-test" }, makeCtx(sessionId), makeDeps(notraceDir, sessionId));
  parentPort?.postMessage("done");
}

if (isMainThread) {
  afterEach(() => {
    vi.restoreAllMocks();
    while (tempDirs.length) cleanupTempNotraceDir(tempDirs.pop()!);
  });

  describe("handleSessionShutdown lock behavior", () => {
    it("keeps both index entries from two concurrent shutdowns", async () => {
      const notraceDir = makeTempNotraceDir();
      tempDirs.push(notraceDir);
      execSync("npm run build", { cwd: process.cwd(), stdio: "ignore" });

      await Promise.all([
        runWorker("session-a", notraceDir),
        runWorker("session-b", notraceDir),
      ]);

      const index = readJson(path.join(notraceDir, "index.json"));
      const sessionIds = index.sessions.map((session: { sessionId: string }) => session.sessionId).sort();

      expect(sessionIds).toEqual(["session-a", "session-b"]);
    });

    it("warns and skips index update when lock acquisition fails", async () => {
      const notraceDir = makeTempNotraceDir();
      tempDirs.push(notraceDir);

      const indexPath = path.join(notraceDir, "index.json");
      const lockPath = `${indexPath}.lock`;
      const seed = { sessions: [{ sessionId: "existing-session" }] };
      writeFileSync(indexPath, `${JSON.stringify(seed, null, 2)}\n`);
      writeFileSync(lockPath, "held");

      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const log = vi.spyOn(console, "log").mockImplementation(() => {});

      await expect(handleSessionShutdown(
        { reason: "lock-held" },
        makeCtx("skipped-session"),
        makeDeps(notraceDir, "skipped-session"),
      )).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Could not acquire index lock"));
      expect(readJson(indexPath)).toEqual(seed);
      expect(existsSync(path.join(sessionDir(notraceDir, "skipped-session"), "notrace.json"))).toBe(true);
      expect(existsSync(lockPath)).toBe(true);
      expect(log).toHaveBeenCalled();
    });

    it("removes the lock file after a successful shutdown", async () => {
      const notraceDir = makeTempNotraceDir();
      tempDirs.push(notraceDir);

      const lockPath = path.join(notraceDir, "index.json.lock");
      const log = vi.spyOn(console, "log").mockImplementation(() => {});

      await handleSessionShutdown(
        { reason: "success" },
        makeCtx("lock-cleanup-session"),
        makeDeps(notraceDir, "lock-cleanup-session"),
      );

      expect(existsSync(lockPath)).toBe(false);
      expect(log).toHaveBeenCalled();
    });

    it("writes a correct index entry for a normal shutdown", async () => {
      const notraceDir = makeTempNotraceDir();
      tempDirs.push(notraceDir);
      const sessionId = "single-session";

      mkdirSync(notraceDir, { recursive: true });
      vi.spyOn(console, "log").mockImplementation(() => {});

      await handleSessionShutdown(
        { reason: "normal" },
        makeCtx(sessionId),
        makeDeps(notraceDir, sessionId),
      );

      const index = readJson(path.join(notraceDir, "index.json"));
      expect(index.sessions).toHaveLength(1);
      expect(index.sessions[0].sessionId).toBe(sessionId);
      expect(index.sessions[0].repositoryName).toBe(path.basename(process.cwd()));
      expect(path.isAbsolute(index.sessions[0].artifacts.html)).toBe(false);
      expect(path.isAbsolute(index.sessions[0].artifacts.record)).toBe(false);
      expect(existsSync(path.join(notraceDir, index.sessions[0].artifacts.html))).toBe(true);
      expect(existsSync(path.join(notraceDir, index.sessions[0].artifacts.record))).toBe(true);
    });
  });
}
