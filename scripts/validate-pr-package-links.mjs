#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export function issueRefs(text) {
  return [...new Set([...String(text || "").matchAll(/\bRefs\s+#(\d+)\b/gi)].map((match) => match[1]))];
}

export function hasPackageChanges(files) {
  return files.some((file) => file.startsWith("packages/"));
}

export function validatePrPackageLinks({
  files,
  body,
  readChangeset = (file) => readFileSync(file, "utf8"),
  fileExists = existsSync,
}) {
  if (!hasPackageChanges(files)) {
    return { ok: true };
  }

  const autoClosePattern = /\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\s+#\d+/i;
  if (autoClosePattern.test(body)) {
    return {
      ok: false,
      lines: [
        "Package PRs must not auto-close issues before the npm release is published.",
        "Use `Refs #<issue>` in the PR body, then close the issue after the package release is available on npm.",
        "If this package change is not released through npm, explain that explicitly and adjust this check if needed.",
      ],
    };
  }

  const prIssueRefs = issueRefs(body);
  if (prIssueRefs.length === 0) {
    return { ok: true };
  }

  const changesetFiles = files.filter(
    (file) => /^\.changeset\/[^/]+\.md$/.test(file) && file !== ".changeset/README.md" && fileExists(file),
  );
  const changesetText = changesetFiles.map((file) => readChangeset(file)).join("\n");
  const changesetIssueRefs = new Set(issueRefs(changesetText));
  const missing = prIssueRefs.filter((issue) => !changesetIssueRefs.has(issue));
  if (missing.length === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    lines: [
      "Package PR issue refs must also appear in a changeset file.",
      "The post-publish closer reads package changelogs generated from changesets, not the PR body.",
      `Missing from changesets: ${missing.map((issue) => `#${issue}`).join(", ")}`,
    ],
  };
}

function changedFiles(baseRef) {
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

function main() {
  const body = process.env.PR_BODY ?? "";
  const baseRef = process.env.GITHUB_BASE_REF || "main";
  const result = validatePrPackageLinks({ files: changedFiles(baseRef), body });
  if (result.ok) {
    return;
  }
  for (const line of result.lines) {
    console.error(line);
  }
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
