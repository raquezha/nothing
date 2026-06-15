#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, relative, dirname, basename, extname, join } from "node:path";

function usage() {
  console.error("Usage: node scripts/notrace-compare.mjs <baseline-notrace.json> <candidate-notrace.json>");
  process.exit(1);
}

const [, , baselineArg, candidateArg] = process.argv;
if (!baselineArg || !candidateArg) usage();

function loadReview(runPath) {
  const reviewPath = join(dirname(runPath), `${basename(runPath, extname(runPath))}.review.json`);
  try {
    const data = JSON.parse(readFileSync(reviewPath, "utf8"));
    if (data?.kind !== "notrace-review") return null;
    return data;
  } catch {
    return null;
  }
}

function loadRun(filePath) {
  const absolutePath = resolve(filePath);
  const data = JSON.parse(readFileSync(absolutePath, "utf8"));
  if (data?.kind !== "notrace-run") {
    throw new Error(`${filePath} is not a notrace run record`);
  }
  return { path: absolutePath, data, review: loadReview(absolutePath) };
}

function fmtNumber(value) {
  return Number(value || 0).toLocaleString();
}

function fmtUsd(value) {
  return `$${Number(value || 0).toFixed(5)}`;
}

function fmtMs(value) {
  const ms = Number(value || 0);
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtDelta(delta, formatter = fmtNumber, invertGood = false) {
  const good = invertGood ? delta > 0 : delta < 0;
  const bad = invertGood ? delta < 0 : delta > 0;
  const sign = delta > 0 ? "+" : "";
  const text = `${sign}${formatter(delta)}`;
  if (good) return `${text} better`;
  if (bad) return `${text} worse`;
  return `${text} same`;
}

function list(value) {
  return Array.isArray(value) && value.length ? value.join(", ") : "-";
}

const baseline = loadRun(baselineArg);
const candidate = loadRun(candidateArg);

const a = baseline.data;
const b = candidate.data;
const aReview = baseline.review;
const bReview = candidate.review;
const aActivity = a.activity || {};
const bActivity = b.activity || {};
const aTotals = aActivity.totals || {};
const bTotals = bActivity.totals || {};

const rows = [
  {
    label: "Total tokens",
    baseline: fmtNumber(aTotals.totalTokens),
    candidate: fmtNumber(bTotals.totalTokens),
    delta: fmtDelta((bTotals.totalTokens || 0) - (aTotals.totalTokens || 0))
  },
  {
    label: "Input tokens",
    baseline: fmtNumber(aTotals.inputTokens),
    candidate: fmtNumber(bTotals.inputTokens),
    delta: fmtDelta((bTotals.inputTokens || 0) - (aTotals.inputTokens || 0))
  },
  {
    label: "Output tokens",
    baseline: fmtNumber(aTotals.outputTokens),
    candidate: fmtNumber(bTotals.outputTokens),
    delta: fmtDelta((bTotals.outputTokens || 0) - (aTotals.outputTokens || 0))
  },
  {
    label: "Duration",
    baseline: fmtMs(aActivity.durationMs),
    candidate: fmtMs(bActivity.durationMs),
    delta: fmtDelta((bActivity.durationMs || 0) - (aActivity.durationMs || 0), fmtMs)
  },
  {
    label: "LLM calls",
    baseline: fmtNumber(aActivity.llmCallCount),
    candidate: fmtNumber(bActivity.llmCallCount),
    delta: fmtDelta((bActivity.llmCallCount || 0) - (aActivity.llmCallCount || 0))
  },
  {
    label: "Tool calls",
    baseline: fmtNumber(aActivity.toolCallCount),
    candidate: fmtNumber(bActivity.toolCallCount),
    delta: fmtDelta((bActivity.toolCallCount || 0) - (aActivity.toolCallCount || 0))
  },
  {
    label: "Tool errors",
    baseline: fmtNumber(aActivity.toolErrorCount),
    candidate: fmtNumber(bActivity.toolErrorCount),
    delta: fmtDelta((bActivity.toolErrorCount || 0) - (aActivity.toolErrorCount || 0))
  },
  {
    label: "Cost (USD)",
    baseline: fmtUsd(aTotals.totalCostUsd),
    candidate: fmtUsd(bTotals.totalCostUsd),
    delta: fmtDelta((bTotals.totalCostUsd || 0) - (aTotals.totalCostUsd || 0), fmtUsd)
  }
];

const labelWidth = Math.max(...rows.map((row) => row.label.length));
const baselineWidth = Math.max("Baseline".length, ...rows.map((row) => row.baseline.length));
const candidateWidth = Math.max("Candidate".length, ...rows.map((row) => row.candidate.length));

function pad(value, width) {
  return String(value).padEnd(width);
}

console.log("notrace compare\n");
console.log(`Baseline : ${relative(process.cwd(), baseline.path) || baseline.path}`);
console.log(`Candidate: ${relative(process.cwd(), candidate.path) || candidate.path}`);
console.log("");
console.log(`Task      : ${b.task?.id || a.task?.id || "(none)"}`);
console.log(`Capture   : ${a.captureMode} -> ${b.captureMode}`);
console.log(`Models    : ${list(a.conditions?.models)} -> ${list(b.conditions?.models)}`);
console.log(`Providers : ${list(a.conditions?.providers)} -> ${list(b.conditions?.providers)}`);
console.log("");
console.log(`Review    : ${(aReview?.outcome || "-")}/${(aReview?.friction || "-")} -> ${(bReview?.outcome || "-")}/${(bReview?.friction || "-")}`);
if (aReview?.lesson || bReview?.lesson) {
  console.log(`Lessons   : ${(aReview?.lesson || "-")} -> ${(bReview?.lesson || "-")}`);
}
if (aReview?.nextChange || bReview?.nextChange) {
  console.log(`Next      : ${(aReview?.nextChange || "-")} -> ${(bReview?.nextChange || "-")}`);
}
console.log("");
console.log(`${pad("Metric", labelWidth)} | ${pad("Baseline", baselineWidth)} | ${pad("Candidate", candidateWidth)} | Delta`);
console.log(`${"-".repeat(labelWidth)}-+-${"-".repeat(baselineWidth)}-+-${"-".repeat(candidateWidth)}-+-${"-".repeat(24)}`);
for (const row of rows) {
  console.log(`${pad(row.label, labelWidth)} | ${pad(row.baseline, baselineWidth)} | ${pad(row.candidate, candidateWidth)} | ${row.delta}`);
}
