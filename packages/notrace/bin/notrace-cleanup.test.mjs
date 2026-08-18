import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeNotraceDir, applyReport, createReport } from "./notrace-cleanup.mjs";

const binDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(binDir, "..");
const tempDirs = [];

function makeNotraceDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "notrace-cleanup-"));
  tempDirs.push(dir);
  mkdirSync(path.join(dir, "sessions", "old"), { recursive: true });
  mkdirSync(path.join(dir, "sessions", "keep"), { recursive: true });
  mkdirSync(path.join(dir, "sessions", "preserved"), { recursive: true });
  writeFileSync(path.join(dir, "index.json"), "{}\n");
  writeFileSync(path.join(dir, "sessions", "old", "notrace.json"), JSON.stringify({ session: { endedAt: "2024-01-01T00:00:00Z" } }));
  writeFileSync(path.join(dir, "sessions", "keep", "notrace.json"), JSON.stringify({ session: { endedAt: "2099-01-01T00:00:00Z" } }));
  writeFileSync(path.join(dir, "sessions", "preserved", "notrace.json"), JSON.stringify({ session: { endedAt: "2024-01-01T00:00:00Z" } }));
  writeFileSync(path.join(dir, "sessions", "preserved", ".preserve"), "");
  writeFileSync(path.join(dir, "index.json.lock"), "held");
  const stale = new Date(Date.now() - (48 * 60 * 60 * 1000));
  utimesSync(path.join(dir, "index.json.lock"), stale, stale);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

describe("notrace-cleanup", () => {
  it("reports usage for an existing notrace directory", () => {
    const dir = makeNotraceDir();

    const summary = analyzeNotraceDir(dir);
    const report = createReport(summary, { dryRun: true });

    expect(report.exists).toBe(true);
    expect(report.sessionCount).toBe(3);
    expect(report.fileCount).toBe(6);
    expect(report.dryRun.retentionConfigured).toBe(false);
    expect(report.candidates).toHaveLength(1);
    expect(report.candidates[0].reason).toBe("stale-lock");
  });

  it("skips preserved sessions and selects old sessions by age", () => {
    const dir = makeNotraceDir();
    const report = createReport(analyzeNotraceDir(dir), { dryRun: true, maxAgeDays: 30 });

    expect(report.dryRun.retentionConfigured).toBe(true);
    expect(report.candidates.map((candidate) => candidate.sessionId).filter(Boolean)).toEqual(["old"]);
    expect(report.candidates.some((candidate) => candidate.path.endsWith("index.json.lock"))).toBe(true);
  });

  it("deletes size-pressure sessions and stale lock artifacts on apply", () => {
    const dir = makeNotraceDir();
    const summary = analyzeNotraceDir(dir);
    const keepBytes = summary.sessions.find((session) => session.id === "keep").totalBytes;
    const preservedBytes = summary.sessions.find((session) => session.id === "preserved").totalBytes;
    const report = createReport(summary, { apply: true, maxTotalBytes: keepBytes + preservedBytes - 1 });
    const result = applyReport(report);

    expect(result.deletedCount).toBe(2);
    expect(existsSync(path.join(dir, "sessions", "old"))).toBe(false);
    expect(readFileSync(path.join(dir, "sessions", "keep", "notrace.json"), "utf8")).toContain("2099");
    expect(existsSync(path.join(dir, "index.json.lock"))).toBe(false);
  });

  it("prints retention dry-run json", () => {
    const dir = makeNotraceDir();
    const stdout = execFileSync(
      "node",
      ["./bin/notrace-cleanup.mjs", "--dir", dir, "--dry-run", "--max-age-days", "30", "--json"],
      { cwd: packageDir, encoding: "utf8" },
    );

    const report = JSON.parse(stdout);
    expect(report.sessionCount).toBe(3);
    expect(report.dryRun.enabled).toBe(true);
    expect(report.dryRun.retentionConfigured).toBe(true);
    expect(report.candidates.some((candidate) => candidate.sessionId === "old")).toBe(true);
    expect(report.candidates.some((candidate) => candidate.path.endsWith("index.json.lock"))).toBe(true);
  });
});
