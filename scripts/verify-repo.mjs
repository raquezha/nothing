#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const failures = [];

function ok(message) {
  console.log(`✓ ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`✗ ${message}`);
}

function assert(condition, message) {
  if (condition) ok(message);
  else fail(message);
}

async function walk(dir, options = {}) {
  const ignore = new Set(options.ignore ?? [".git", "node_modules", "dist", ".reposcry", "vendor"]);
  const out = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (ignore.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(full);
      else out.push(full);
    }
  }
  await visit(dir);
  return out;
}

async function fileContainsDeprecatedPiNamespace() {
  const files = await walk(root);
  const banned = /@mariozechner\/(pi-coding-agent|pi-ai|pi-agent-core|pi-tui)/;
  const hits = [];
  for (const file of files) {
    if (!/\.(ts|js|cjs|mjs|json|md|yml|yaml|sh)$/.test(file)) continue;
    const text = await readFile(file, "utf8").catch(() => "");
    if (banned.test(text)) hits.push(path.relative(root, file));
  }
  assert(hits.length === 0, hits.length ? `deprecated @mariozechner Pi namespace found: ${hits.join(", ")}` : "no deprecated @mariozechner Pi namespace usage");
}

function resolveSkill(spec) {
  const candidates = [
    path.join(root, "packages", spec),
    path.join(root, spec),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function resolveExtension(spec) {
  const candidates = [
    path.join(root, "packages", spec),
    path.join(root, spec),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

async function containsSkillMd(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return false;
  const files = await walk(dir, { ignore: [".git", "node_modules", "dist", ".reposcry"] });
  return files.some((file) => path.basename(file) === "SKILL.md");
}

async function verifyMindsets() {
  const mindsets = JSON.parse(readFileSync(path.join(root, "mindsets.json"), "utf8")).mindsets;
  for (const [name, config] of Object.entries(mindsets)) {
    for (const skill of config.skills ?? []) {
      const resolved = resolveSkill(skill);
      assert(Boolean(resolved), `mindset ${name} skill path resolves: ${skill}`);
      if (resolved) assert(await containsSkillMd(resolved), `mindset ${name} skill path contains SKILL.md: ${skill}`);
    }
    for (const extension of config.extensions ?? []) {
      const resolved = resolveExtension(extension);
      assert(Boolean(resolved), `mindset ${name} extension path resolves: ${extension}`);
      if (resolved) {
        assert(existsSync(path.join(resolved, "package.json")), `mindset ${name} extension has package.json: ${extension}`);
        assert(existsSync(path.join(resolved, "dist", "index.js")), `mindset ${name} extension is built: ${extension}`);
      }
    }
  }
}

function verifyInstallers() {
  const temp = mkdtempSync(path.join(tmpdir(), "nothing-installers-"));
  try {
    const norpivDest = path.join(temp, "norpiv");
    execFileSync("node", [path.join(root, "packages/norpiv/bin/norpiv-install.cjs"), "--dest", norpivDest, "--copy"], { cwd: root, stdio: "pipe" });
    assert(existsSync(path.join(norpivDest, "triage", "SKILL.md")), "norpiv installer copies triage skill");
    assert(existsSync(path.join(norpivDest, "scripts", "triage_helper.sh")), "norpiv installer copies shared scripts");

    const nosearchDest = path.join(temp, "nosearch");
    execFileSync("node", [path.join(root, "packages/nosearch/bin/nosearch-install.cjs"), "--dest", nosearchDest, "--copy"], { cwd: root, stdio: "pipe" });
    assert(existsSync(path.join(nosearchDest, "brave-search", "SKILL.md")), "nosearch installer copies brave-search skill");
    assert(existsSync(path.join(nosearchDest, "firecrawl", "SKILL.md")), "nosearch installer copies firecrawl skill");
  } catch (error) {
    fail(`installer verification failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function run(cmd, args, cwd, options = {}) {
  return spawnSync(cmd, args, { cwd, encoding: "utf8", ...options });
}

function verifyReposcryGuardrails() {
  const script = path.join(root, "packages/norpiv/scripts/reposcry-bootstrap.sh");
  const temp = mkdtempSync(path.join(tmpdir(), "nothing-reposcry-"));
  try {
    run("git", ["init", "-q"], temp);
    run("git", ["config", "user.email", "test@example.com"], temp);
    run("git", ["config", "user.name", "Test"], temp);
    const result = run("bash", [script], temp);
    assert(result.status === 0, "reposcry bootstrap succeeds in temp git repo");
    const gitignore = readFileSync(path.join(temp, ".gitignore"), "utf8");
    assert(gitignore.split(/\r?\n/).includes(".reposcry/"), "reposcry bootstrap adds .reposcry/ to repo .gitignore");
    assert(!gitignore.includes(".reposcryignore"), "reposcry bootstrap does not ignore .reposcryignore");
  } catch (error) {
    fail(`reposcry guardrail bootstrap test failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  const trackedTemp = mkdtempSync(path.join(tmpdir(), "nothing-reposcry-tracked-"));
  try {
    run("git", ["init", "-q"], trackedTemp);
    run("bash", ["-lc", "mkdir -p .reposcry && echo cache > .reposcry/cache.db && git add -f .reposcry/cache.db"], trackedTemp);
    const result = run("bash", [script], trackedTemp);
    assert(result.status !== 0, "reposcry bootstrap refuses tracked/staged .reposcry cache");
    assert(`${result.stdout}${result.stderr}`.includes("must not be committed"), "reposcry refusal explains cache must not be committed");
  } catch (error) {
    fail(`reposcry tracked-cache test failed: ${error.message}`);
  } finally {
    rmSync(trackedTemp, { recursive: true, force: true });
  }
}

function verifyWorkflowFiles() {
  const android = readFileSync(path.join(root, ".github/workflows/sync-upstream-skills.yml"), "utf8");
  assert(android.includes("vendor/android-skills/"), "android sync workflow targets vendor/android-skills");
  assert(!android.includes("packages/android"), "android sync workflow no longer targets packages/android");
  assert(android.includes("pull-requests: write"), "android sync workflow can create PRs");

  const publish = readFileSync(path.join(root, ".github/workflows/publish-packages.yml"), "utf8");
  assert(publish.includes("changesets/action@v1"), "publish workflow uses changesets action");
  assert(!publish.includes("pending_changesets"), "publish workflow does not deadlock on pending changesets");
}

await fileContainsDeprecatedPiNamespace();
await verifyMindsets();
verifyInstallers();
verifyReposcryGuardrails();
verifyWorkflowFiles();

if (failures.length) {
  console.error(`\n${failures.length} verification failure(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nrepo verification ✓");
