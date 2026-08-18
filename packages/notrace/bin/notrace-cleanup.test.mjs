import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeNotraceDir, createReport } from "./notrace-cleanup.mjs";

const binDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(binDir, "..");

const tempDirs = [];

function makeNotraceDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "notrace-cleanup-"));
  tempDirs.push(dir);
  mkdirSync(path.join(dir, "sessions", "one"), { recursive: true });
  mkdirSync(path.join(dir, "sessions", "two"), { recursive: true });
  writeFileSync(path.join(dir, "index.json"), "{}\n");
  writeFileSync(path.join(dir, "sessions", "one", "notrace.json"), "12345");
  writeFileSync(path.join(dir, "sessions", "two", "notrace.json"), "1234567");
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
    expect(report.sessionCount).toBe(2);
    expect(report.fileCount).toBe(3);
    expect(report.totalBytes).toBe(15);
    expect(report.dryRun.wouldDeleteBytes).toBe(0);
    expect(report.dryRun.retentionConfigured).toBe(false);
  });

  it("prints dry-run json without deleting anything", () => {
    const dir = makeNotraceDir();
    const stdout = execFileSync(
      "node",
      ["./bin/notrace-cleanup.mjs", "--dir", dir, "--dry-run", "--json"],
      { cwd: packageDir, encoding: "utf8" },
    );

    const report = JSON.parse(stdout);
    expect(report.directory).toBe(path.resolve(dir));
    expect(report.sessionCount).toBe(2);
    expect(report.totalBytes).toBe(15);
    expect(report.dryRun.enabled).toBe(true);
    expect(report.dryRun.notes[0]).toContain("nothing would be deleted");
  });
});
