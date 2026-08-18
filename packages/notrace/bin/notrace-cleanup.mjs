#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function defaultNotraceDir() {
  return process.env.NOTRACE_DIR || join(os.homedir(), ".notrace");
}

function walk(filePath) {
  const stat = statSync(filePath);
  if (!stat.isDirectory()) {
    return { totalBytes: stat.size, fileCount: 1 };
  }

  let totalBytes = 0;
  let fileCount = 0;
  for (const entry of readdirSync(filePath, { withFileTypes: true })) {
    const child = walk(join(filePath, entry.name));
    totalBytes += child.totalBytes;
    fileCount += child.fileCount;
  }
  return { totalBytes, fileCount };
}

export function analyzeNotraceDir(inputDir = defaultNotraceDir()) {
  const directory = resolve(inputDir);
  if (!existsSync(directory)) {
    return {
      directory,
      exists: false,
      sessionCount: 0,
      fileCount: 0,
      totalBytes: 0,
    };
  }

  const sessionsDir = join(directory, "sessions");
  const sessionCount = existsSync(sessionsDir)
    ? readdirSync(sessionsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length
    : 0;
  const usage = walk(directory);

  return {
    directory,
    exists: true,
    sessionCount,
    fileCount: usage.fileCount,
    totalBytes: usage.totalBytes,
  };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function createReport(summary, { dryRun = false } = {}) {
  const report = {
    ...summary,
    dryRun: {
      enabled: dryRun,
      wouldDeleteBytes: 0,
      retentionConfigured: false,
      notes: dryRun ? ["No explicit retention is configured yet; nothing would be deleted."] : [],
    },
  };

  return report;
}

function usage() {
  console.error("Usage: notrace-cleanup [--dir <path>] [--dry-run] [--json]");
  process.exit(1);
}

export function parseArgs(argv) {
  let dir;
  let dryRun = false;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dir") {
      dir = argv[++i];
      if (!dir) usage();
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") usage();
    usage();
  }

  return { dir, dryRun, json };
}

export function renderText(report) {
  const lines = [
    "notrace cleanup",
    "",
    `Directory : ${report.directory}`,
    `Exists    : ${report.exists ? "yes" : "no"}`,
    `Sessions  : ${report.sessionCount}`,
    `Files     : ${report.fileCount}`,
    `Total     : ${formatBytes(report.totalBytes)}`,
  ];

  if (report.dryRun.enabled) {
    lines.push(
      "",
      "Dry run",
      `Would delete: ${formatBytes(report.dryRun.wouldDeleteBytes)}`,
      ...report.dryRun.notes,
    );
  }

  return `${lines.join("\n")}\n`;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const report = createReport(analyzeNotraceDir(args.dir), { dryRun: args.dryRun });
  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : renderText(report));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
