#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, relative, dirname, basename, extname, join } from "node:path";

const VALID_OUTCOMES = new Set(["success", "partial", "failed", "abandoned", "inconclusive"]);
const VALID_FRICTION = new Set(["low", "medium", "high"]);

function appendWorkLogEntry(taskDir, message) {
  const workMd = join(taskDir, "WORK.md");
  if (!existsSync(workMd)) return;

  const text = readFileSync(workMd, "utf8");
  const entry = `- ${new Date().toISOString()}: ${message}`;

  if (!/^(## )?\[LOG\]\s*$/m.test(text)) {
    writeFileSync(workMd, `${text.trimEnd()}\n\n## [LOG]\n${entry}\n`, { encoding: "utf8" });
    return;
  }

  const lines = text.split("\n");
  const logIndex = lines.findIndex((line) => /^(## )?\[LOG\]\s*$/.test(line));
  if (logIndex === -1) return;

  let nextSectionIndex = lines.length;
  for (let i = logIndex + 1; i < lines.length; i++) {
    if (/^(## )?\[[A-Z0-9_-]+\]\s*$/.test(lines[i])) {
      nextSectionIndex = i;
      break;
    }
  }

  const before = lines.slice(0, nextSectionIndex);
  const after = lines.slice(nextSectionIndex);
  while (before.length > logIndex + 1 && before[before.length - 1]?.trim() === "") {
    before.pop();
  }
  before.push(entry);

  writeFileSync(workMd, `${[...before, ...after].join("\n").replace(/\n*$/, "\n")}`, { encoding: "utf8" });
}

function usage() {
  console.error("Usage: node scripts/notrace-review.mjs <notrace.json> [--outcome value] [--friction value] [--lesson text] [--next-change text]");
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args.length) usage();

const runPath = resolve(args[0]);
const flags = args.slice(1);

function takeFlag(name) {
  const index = flags.indexOf(name);
  if (index === -1) return undefined;
  const value = flags[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

const outcome = takeFlag("--outcome");
const friction = takeFlag("--friction");
const lesson = takeFlag("--lesson");
const nextChange = takeFlag("--next-change");

if (!existsSync(runPath)) {
  throw new Error(`Run record not found: ${runPath}`);
}

const run = JSON.parse(readFileSync(runPath, "utf8"));
if (run?.kind !== "notrace-run") {
  throw new Error(`Not a notrace run record: ${runPath}`);
}

if (outcome && !VALID_OUTCOMES.has(outcome)) {
  throw new Error(`Invalid outcome: ${outcome}`);
}
if (friction && !VALID_FRICTION.has(friction)) {
  throw new Error(`Invalid friction: ${friction}`);
}

const reviewPath = join(dirname(runPath), `${basename(runPath, extname(runPath))}.review.json`);
const existing = existsSync(reviewPath)
  ? JSON.parse(readFileSync(reviewPath, "utf8"))
  : {
      schemaVersion: 1,
      kind: "notrace-review",
      traceId: run.traceId,
      runRecord: basename(runPath),
      outcome: null,
      friction: null,
      lesson: "",
      nextChange: ""
    };

const review = {
  ...existing,
  traceId: run.traceId,
  runRecord: basename(runPath),
  outcome: outcome ?? existing.outcome ?? null,
  friction: friction ?? existing.friction ?? null,
  lesson: lesson ?? existing.lesson ?? "",
  nextChange: nextChange ?? existing.nextChange ?? ""
};

writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

if (run.repository?.cwd && (run.task?.dir || run.task?.path)) {
  const taskDir = run.task?.dir
    ? resolve(run.task.dir)
    : resolve(run.repository.cwd, run.task.path);
  appendWorkLogEntry(taskDir, `notrace review recorded: outcome=${review.outcome ?? "-"}, friction=${review.friction ?? "-"}, review=${relative(taskDir, reviewPath)}`);
} else {
  appendWorkLogEntry(dirname(runPath), `notrace review recorded: outcome=${review.outcome ?? "-"}, friction=${review.friction ?? "-"}, review=${basename(reviewPath)}`);
}

console.log(`notrace review ✓ ${reviewPath}`);
console.log(`  outcome   : ${review.outcome ?? "-"}`);
console.log(`  friction  : ${review.friction ?? "-"}`);
console.log(`  lesson    : ${review.lesson || "-"}`);
console.log(`  nextChange: ${review.nextChange || "-"}`);
