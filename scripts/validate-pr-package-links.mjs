#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const body = process.env.PR_BODY ?? "";
const baseRef = process.env.GITHUB_BASE_REF || "main";

function changedFiles() {
  try {
    return execFileSync("git", ["diff", "--name-only", `origin/${baseRef}...HEAD`], { encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    console.error(`Could not determine changed files against origin/${baseRef}.`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const files = changedFiles();
const packageChanged = files.some((file) => /^packages\/[^/]+\//.test(file));
if (!packageChanged) process.exit(0);

const autoClosePattern = /\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\s+#\d+/i;
if (autoClosePattern.test(body)) {
  console.error("Package PRs must not auto-close issues before the npm release is published.");
  console.error("Use `Refs #<issue>` in the PR body, then close the issue after the package release is available on npm.");
  console.error("If this package change is not released through npm, explain that explicitly and adjust this check if needed.");
  process.exit(1);
}

const prIssueRefs = issueRefs(body);
if (prIssueRefs.length === 0) process.exit(0);

const changesetFiles = files.filter(
  (file) => /^\.changeset\/[^/]+\.md$/.test(file) && file !== ".changeset/README.md" && existsSync(file),
);
const changesetText = changesetFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const changesetIssueRefs = new Set(issueRefs(changesetText));
const missing = prIssueRefs.filter((issue) => !changesetIssueRefs.has(issue));
if (missing.length === 0) process.exit(0);

console.error("Package PR issue refs must also appear in a changeset file.");
console.error("The post-publish closer reads package changelogs generated from changesets, not the PR body.");
console.error(`Missing from changesets: ${missing.map((issue) => `#${issue}`).join(", ")}`);
process.exit(1);

function issueRefs(text) {
  return [...new Set([...text.matchAll(/\bRefs\s+#(\d+)\b/gi)].map((match) => match[1]))];
}
