#!/usr/bin/env node
import { execFileSync } from "node:child_process";

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
if (!autoClosePattern.test(body)) process.exit(0);

console.error("Package PRs must not auto-close issues before the npm release is published.");
console.error("Use `Refs #<issue>` in the PR body, then close the issue after the package release is available on npm.");
console.error("If this package change is not released through npm, explain that explicitly and adjust this check if needed.");
process.exit(1);
