#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.env.GITHUB_REPOSITORY;
const publishedRaw = process.env.PUBLISHED_PACKAGES ?? "[]";
const dryRun = process.env.DRY_RUN === "true";

if (!repo) {
  console.error("GITHUB_REPOSITORY is required.");
  process.exit(1);
}

let published;
try {
  published = JSON.parse(publishedRaw);
} catch (error) {
  console.error("PUBLISHED_PACKAGES must be valid JSON from changesets/action.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (!Array.isArray(published) || published.length === 0) {
  console.log("No published packages supplied; nothing to close.");
  process.exit(0);
}

const packageDirs = new Map();
for (const dir of listPackageDirs()) {
  const packageJsonPath = join(dir, "package.json");
  if (!existsSync(packageJsonPath)) continue;
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  packageDirs.set(pkg.name, { dir, version: pkg.version });
}

for (const item of published) {
  const name = item.name;
  const version = item.version;
  if (typeof name !== "string") continue;
  const local = packageDirs.get(name);
  if (!local) {
    console.log(`No local package directory found for ${name}; skipping.`);
    continue;
  }

  const changelogPath = join(local.dir, "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    console.log(`No changelog found for ${name}; skipping issue close.`);
    continue;
  }

  const changelog = readFileSync(changelogPath, "utf8");
  const section = latestChangelogSection(changelog);
  const issues = [...new Set([...section.matchAll(/\bRefs\s+#(\d+)\b/gi)].map((match) => match[1]))];
  if (issues.length === 0) {
    console.log(`No Refs #issue entries found in latest changelog section for ${name}@${version}; skipping.`);
    continue;
  }

  for (const issue of issues) {
    const body = `Released in \`${name}@${version}\`. Closing now that the npm package is available.\n\n🤖 Automated by package release workflow.`;
    if (dryRun) {
      console.log(`[dry-run] Would comment and close ${repo}#${issue}: ${body}`);
      continue;
    }
    execFileSync("gh", ["issue", "comment", issue, "--repo", repo, "--body", body], { stdio: "inherit" });
    execFileSync("gh", ["issue", "close", issue, "--repo", repo], { stdio: "inherit" });
  }
}

function listPackageDirs() {
  const stdout = execFileSync("git", ["ls-files", "packages/*/package.json"], { encoding: "utf8" });
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((file) => file.replace(/\/package\.json$/, ""));
}

function latestChangelogSection(changelog) {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => /^##\s+/.test(line));
  if (start < 0) return "";
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (/^##\s+/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}
