#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STALE_MS = 24 * 60 * 60 * 1000;
const PRESERVE_FILE = ".preserve";
const MAX_TEXT_CANDIDATES = 20;
const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  magenta: "\u001b[35m",
  red: "\u001b[31m",
};

function paint(style, text) {
  return `${style}${text}${ANSI.reset}`;
}

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

function visibleLength(text) {
  return stripAnsi(text).length;
}

function rule(color = ANSI.dim, char = "─", width = 56) {
  return paint(color, char.repeat(width));
}

function boxLine(left, fill, right, color, width = 56) {
  return paint(color, `${left}${fill.repeat(width)}${right}`);
}

function boxRow(text, color = ANSI.cyan, width = 56) {
  const len = visibleLength(text);
  const pad = Math.max(0, width - 2 - len);
  return `${paint(color, "│ ")}${text}${" ".repeat(pad)}${paint(color, "│")}`;
}

function boxPair(label, value, color = ANSI.cyan, width = 56) {
  const raw = `${label} ${value}`;
  return boxRow(raw, color, width);
}

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

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function sessionTimestamp(sessionDir, sessionId) {
  const record = readJson(join(sessionDir, "notrace.json"));
  const endedAt = Date.parse(record?.session?.endedAt || "");
  if (Number.isFinite(endedAt)) return endedAt;
  const startedAt = Date.parse(record?.session?.startedAt || "");
  if (Number.isFinite(startedAt)) return startedAt;

  const index = readJson(join(resolve(sessionDir, "..", ".."), "index.json"));
  const match = index?.sessions?.find?.((entry) => entry?.sessionId === sessionId);
  const indexEndedAt = Date.parse(match?.endedAt || match?.startedAt || "");
  if (Number.isFinite(indexEndedAt)) return indexEndedAt;

  return statSync(sessionDir).mtimeMs;
}

function listSessions(directory) {
  const sessionsDir = join(directory, "sessions");
  if (!existsSync(sessionsDir)) return [];

  return readdirSync(sessionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const sessionDir = join(sessionsDir, entry.name);
      const usage = walk(sessionDir);
      return {
        id: entry.name,
        path: sessionDir,
        preserved: existsSync(join(sessionDir, PRESERVE_FILE)),
        totalBytes: usage.totalBytes,
        timestampMs: sessionTimestamp(sessionDir, entry.name),
      };
    });
}

function listStaleArtifacts(directory, now = Date.now()) {
  const candidates = [];
  const rootEntries = existsSync(directory) ? readdirSync(directory, { withFileTypes: true }) : [];

  for (const entry of rootEntries) {
    const isCandidateFile = !entry.isDirectory() && (entry.name.endsWith(".tmp") || entry.name === "index.json.lock");
    if (!isCandidateFile) continue;

    const filePath = join(directory, entry.name);
    const stat = statSync(filePath);
    const isStale = now - stat.mtimeMs >= STALE_MS;

    if (isStale) {
      candidates.push({
        path: filePath,
        reason: entry.name === "index.json.lock" ? "stale-lock" : "stale-temp",
        totalBytes: stat.size,
      });
    }
  }

  return candidates;
}

function uniqueByPath(items) {
  return [...new Map(items.map((item) => [item.path, item])).values()];
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
      sessions: [],
      staleArtifacts: [],
    };
  }

  const usage = walk(directory);
  const sessions = listSessions(directory);

  return {
    directory,
    exists: true,
    sessionCount: sessions.length,
    fileCount: usage.fileCount,
    totalBytes: usage.totalBytes,
    sessions,
    staleArtifacts: listStaleArtifacts(directory),
  };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function collectRetentionCandidates(summary, options = {}) {
  const candidates = [];
  const sessions = [...summary.sessions].sort((a, b) => b.timestampMs - a.timestampMs);
  const now = Date.now();
  const cutoffMs = options.maxAgeDays == null ? null : now - (options.maxAgeDays * 24 * 60 * 60 * 1000);
  let keptBytes = 0;

  for (const session of sessions) {
    const isExpiredByAge = cutoffMs != null && !session.preserved && session.timestampMs < cutoffMs;
    const fitsSizeBudget = options.maxTotalBytes == null || session.preserved || keptBytes + session.totalBytes <= options.maxTotalBytes;

    if (isExpiredByAge) {
      candidates.push({ path: session.path, type: "session", reason: "max-age", totalBytes: session.totalBytes, sessionId: session.id });
    }

    if (fitsSizeBudget) {
      keptBytes += session.totalBytes;
      continue;
    }

    candidates.push({ path: session.path, type: "session", reason: "max-total-bytes", totalBytes: session.totalBytes, sessionId: session.id });
  }

  for (const artifact of summary.staleArtifacts) {
    candidates.push({ ...artifact, type: "artifact" });
  }

  return uniqueByPath(candidates);
}

export function createReport(summary, options = {}) {
  const retentionConfigured = options.maxAgeDays != null || options.maxTotalBytes != null;
  const candidates = collectRetentionCandidates(summary, options);

  return {
    directory: summary.directory,
    exists: summary.exists,
    sessionCount: summary.sessionCount,
    fileCount: summary.fileCount,
    totalBytes: summary.totalBytes,
    dryRun: {
      enabled: options.dryRun === true,
      wouldDeleteBytes: candidates.reduce((sum, item) => sum + item.totalBytes, 0),
      retentionConfigured,
      notes: retentionConfigured
        ? []
        : [
            candidates.length
              ? "No session retention is configured; only stale temp/lock artifacts are eligible."
              : "No explicit retention is configured yet; nothing would be deleted.",
          ],
    },
    retention: {
      maxAgeDays: options.maxAgeDays ?? null,
      maxTotalBytes: options.maxTotalBytes ?? null,
      preserveMarker: PRESERVE_FILE,
    },
    candidates: candidates.map((item) => ({
      type: item.type,
      reason: item.reason,
      path: item.path,
      sessionId: item.sessionId ?? null,
      totalBytes: item.totalBytes,
    })),
  };
}

export function applyReport(report) {
  const deleted = [];
  for (const candidate of report.candidates) {
    if (!existsSync(candidate.path)) continue;
    rmSync(candidate.path, { recursive: true, force: true });
    deleted.push(candidate.path);
  }
  return { deletedCount: deleted.length, deleted };
}

function usage(exitCode = 1) {
  console.error(`${paint(ANSI.bold + ANSI.cyan, "notrace cleanup")} ${paint(ANSI.dim, "Usage")}`);
  console.error("  notrace-cleanup [--dir <path>] [--dry-run] [--apply] [--max-age-days <n>] [--max-total-mb <n>] [--max-total-bytes <n>] [--json]");
  process.exit(exitCode);
}

function parseNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid value for ${flag}: ${value}`);
  }
  return parsed;
}

export function parseArgs(argv) {
  let dir;
  let dryRun = false;
  let apply = false;
  let json = false;
  let maxAgeDays;
  let maxTotalBytes;

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
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--max-age-days") {
      maxAgeDays = parseNumber(argv[++i], arg);
      continue;
    }
    if (arg === "--max-total-bytes") {
      maxTotalBytes = parseNumber(argv[++i], arg);
      continue;
    }
    if (arg === "--max-total-mb") {
      maxTotalBytes = parseNumber(argv[++i], arg) * 1024 * 1024;
      continue;
    }
    if (arg === "--help" || arg === "-h") usage(0);
    usage();
  }

  if (apply && dryRun) throw new Error("Use either --dry-run or --apply, not both.");

  return { dir, dryRun, apply, json, maxAgeDays, maxTotalBytes };
}

export function renderText(report, result = null) {
  const existsText = report.exists ? paint(ANSI.green, "yes") : paint(ANSI.red, "no");
  const candidates = report.candidates.slice(0, MAX_TEXT_CANDIDATES);
  const hiddenCount = report.candidates.length - candidates.length;

  const lines = [
    `${paint(ANSI.bold + ANSI.cyan, "notrace cleanup")}  ${paint(ANSI.dim, "local trace retention & cleanup preview")}`,
    rule(ANSI.cyan, "─", 64),
    "",
    `  📁 Directory   ${paint(ANSI.dim, report.directory)}`,
    `  ✅ Exists      ${existsText}`,
    `  🧾 Sessions    ${paint(ANSI.bold, String(report.sessionCount))}`,
    `  📄 Files       ${paint(ANSI.bold, String(report.fileCount))}`,
    `  💽 Total       ${paint(ANSI.bold + ANSI.magenta, formatBytes(report.totalBytes))}`,
  ];

  if (report.dryRun.enabled) {
    lines.push(
      "",
      `  ${paint(ANSI.bold + ANSI.yellow, "⚠ Dry run")}`,
      `  🗑  Would delete  ${paint(ANSI.bold, formatBytes(report.dryRun.wouldDeleteBytes))}`,
      `  📌 Candidates    ${paint(ANSI.bold, String(report.candidates.length))}`,
      ...report.dryRun.notes.map((note) => `  ℹ  ${paint(ANSI.dim, note)}`),
    );
  }

  if (result) {
    lines.push(
      "",
      `  ${paint(ANSI.bold + ANSI.green, "🧹 Cleanup applied")}`,
      `  Deleted          ${paint(ANSI.bold + ANSI.green, String(result.deletedCount))}`,
    );
  }

  if (report.candidates.length) {
    lines.push("", `  ${paint(ANSI.bold, "Candidates")}`);

    for (const candidate of candidates) {
      const reasonColor = candidate.reason === "stale-lock" || candidate.reason === "stale-temp" ? ANSI.yellow : ANSI.red;
      const tag = paint(reasonColor, candidate.reason.padEnd(15));
      lines.push(`  • ${tag} ${candidate.path} ${paint(ANSI.dim, `(${formatBytes(candidate.totalBytes)})`)}`);
    }

    if (hiddenCount > 0) {
      lines.push(`  ${paint(ANSI.dim, `… ${hiddenCount} more candidate(s); use --json for the full list`)}`);
    }
  }

  lines.push("", rule(ANSI.cyan, "─", 64));
  return `${lines.join("\n")}\n`;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const report = createReport(analyzeNotraceDir(args.dir), args);
  const result = args.apply ? applyReport(report) : null;
  const output = args.json ? { ...report, apply: result } : renderText(report, result);
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : output);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
