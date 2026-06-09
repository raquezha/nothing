#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
        assert(existsSync(path.join(resolved, "dist", `${path.basename(resolved)}.js`)), `mindset ${name} extension is built: ${extension}`);
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

function verifyPackageLockWorkspaceVersions() {
  const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
  for (const pkgDir of ["noagy", "nofooter", "noleaks", "norpiv", "nosearch", "notrace"]) {
    const workspace = `packages/${pkgDir}`;
    const pkg = JSON.parse(readFileSync(path.join(root, workspace, "package.json"), "utf8"));
    const lockPkg = lock.packages?.[workspace];
    assert(lockPkg?.version === pkg.version, `package-lock matches ${pkg.name} version`);
  }
}

function verifyPackageManifests() {
  const expected = {
    "packages/noagy/package.json": { extensions: ["extensions"] },
    "packages/nofooter/package.json": { extensions: ["extensions"] },
    "packages/noleaks/package.json": { extensions: ["extensions"] },
    "packages/notrace/package.json": { extensions: ["extensions"] },
    "packages/nosearch/package.json": { extensions: ["extensions"], skills: ["brave-search", "firecrawl"] },
    "packages/norpiv/package.json": { skills: ["triage", "frame", "grill-with-docs", "plan", "implement", "verify", "sync", "update-docs", "cleanup"] },
  };

  for (const [file, piManifest] of Object.entries(expected)) {
    const pkg = JSON.parse(readFileSync(path.join(root, file), "utf8"));
    assert(pkg.keywords?.includes("pi-package"), `${file} is tagged as a pi package`);
    assert(JSON.stringify(pkg.pi) === JSON.stringify(piManifest), `${file} declares expected pi resources`);
  }

  const nosearchSource = readFileSync(path.join(root, "packages/nosearch/extensions/nosearch.ts"), "utf8");
  assert(nosearchSource.includes('path.basename(moduleDir) === "dist"'), "nosearch resolves package root when loaded from dist");
}

function verifyShellIntegration() {
  const temp = mkdtempSync(path.join(tmpdir(), "nothing-shell-"));
  try {
    const fakeBin = path.join(temp, "bin");
    const fakePi = path.join(fakeBin, "pi");
    const fakeGit = path.join(fakeBin, "git");
    const fakeNpm = path.join(fakeBin, "npm");
    const argsFile = path.join(temp, "args.txt");
    const installLog = path.join(temp, "installs.txt");
    const cacheDir = path.join(temp, "cache");
    run("mkdir", ["-p", fakeBin], root);
    writeFileSync(fakePi, '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$PI_FAKE_ARGS_FILE"\n');
    writeFileSync(fakeGit, `#!/usr/bin/env bash
set -euo pipefail
printf 'git %s\\n' "$*" >> "$PI_FAKE_INSTALL_LOG"
dest="\${@: -1}"
mkdir -p "$dest/skills/caveman" "$dest/skills/caveman-stats"
printf '%s\\n' '---' 'name: caveman' 'description: fake' '---' > "$dest/skills/caveman/SKILL.md"
printf '%s\\n' '---' 'name: caveman-stats' 'description: fake' '---' > "$dest/skills/caveman-stats/SKILL.md"
`);
    writeFileSync(fakeNpm, `#!/usr/bin/env bash
set -euo pipefail
printf 'npm %s\\n' "$*" >> "$PI_FAKE_INSTALL_LOG"
prefix=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix) prefix="$2"; shift 2 ;;
    *) shift ;;
  esac
done
mkdir -p "$prefix/node_modules/pi-rtk-optimizer"
printf '{"name":"pi-rtk-optimizer","pi":{"extensions":["./index.ts"]}}\\n' > "$prefix/node_modules/pi-rtk-optimizer/package.json"
printf 'export default function(){}\\n' > "$prefix/node_modules/pi-rtk-optimizer/index.ts"
`);
    chmodSync(fakePi, 0o755);
    chmodSync(fakeGit, 0o755);
    chmodSync(fakeNpm, 0o755);

    const env = { ...process.env, PATH: `${fakeBin}:${process.env.PATH}`, PI_FAKE_ARGS_FILE: argsFile, PI_FAKE_INSTALL_LOG: installLog, NOTHING_CACHE_DIR: cacheDir };
    let result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --nothing hello`], root, { env });
    assert(result.status === 0, "bash shell integration runs --nothing with fake pi");
    let args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/) : [];
    assert(args.includes("--system-prompt"), "--nothing overrides the default system prompt");
    assert(args.includes("--no-builtin-tools"), "--nothing disables built-in tools");
    assert(args.includes("--no-prompt-templates"), "--nothing disables prompt templates");
    assert(args.includes("--no-themes"), "--nothing disables themes");
    assert(args.includes("--no-skills") && args.includes("--no-extensions") && args.includes("--no-context-files"), "--nothing disables skills, extensions, and context files");
    assert(!args.includes("--skill") && !args.includes("--extension"), "--nothing does not add local skills or extensions");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi hello`], root, { env });
    assert(result.status === 0, "plain pi remains factory/default under shell integration");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(JSON.stringify(args) === JSON.stringify(["hello"]), "plain pi receives no nothing flags");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --caveman --rtk hello`], root, { env });
    assert(result.status === 0, "caveman and rtk modifiers lazy-install local caches");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(args.filter((arg) => arg === "--skill").length === 2, "--caveman explicitly loads two cached skills");
    assert(args.some((arg) => arg.endsWith("/repos/caveman/skills/caveman")), "--caveman loads cached caveman skill path");
    assert(args.some((arg) => arg.endsWith("/repos/caveman/skills/caveman-stats")), "--caveman loads cached caveman-stats skill path");
    assert(args.includes("--extension") && args.some((arg) => arg.endsWith("/npm/rtk/node_modules/pi-rtk-optimizer")), "--rtk explicitly loads cached RTK optimizer extension");
    const installs = existsSync(installLog) ? readFileSync(installLog, "utf8") : "";
    assert(installs.includes("git clone") && installs.includes("npm install"), "modifiers install into local cache on first use");

    writeFileSync(argsFile, "");
    writeFileSync(installLog, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --caveman --rkt again`], root, { env });
    assert(result.status === 0, "cached caveman and rkt alias run without reinstalling");
    const secondInstalls = existsSync(installLog) ? readFileSync(installLog, "utf8") : "";
    assert(secondInstalls.trim() === "", "modifiers skip install when local cache exists");

    if (run("bash", ["-lc", "command -v zsh >/dev/null 2>&1"], root).status === 0) {
      writeFileSync(argsFile, "");
      result = run("zsh", ["-fc", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --nothing hello`], root, { env });
      assert(result.status === 0, "zsh shell integration runs --nothing with fake pi");
    }
  } catch (error) {
    fail(`shell integration verification failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function verifyBootstrapDryRun() {
  const result = run("bash", [path.join(root, "bootstrap.sh"), "--dry-run", "--no-third-party"], root);
  const output = `${result.stdout}${result.stderr}`;
  assert(result.status === 0, "bootstrap dry-run succeeds with deprecated --no-third-party");
  assert(output.includes("Skipping published package install"), "bootstrap skips published package install by default");
  assert(output.includes("Resetting Pi globals so plain 'pi' starts factory-clean"), "bootstrap resets global Pi discovery by default");
  assert(output.includes("~/.agents/skills") || output.includes("/.agents/skills"), "bootstrap warns that generic global skills are reset");
  assert(output.includes("Skipping global skill links"), "bootstrap skips global skill links by default");
  assert(!output.includes("norpiv-install.cjs --target pi"), "bootstrap does not globally install norpiv skills by default");
  assert(!output.includes("nosearch-install.cjs --target pi"), "bootstrap does not globally install nosearch skills by default");
  assert(output.includes("lazy-install local caches"), "bootstrap documents lazy third-party modifier installs");

  const guarded = run("bash", [path.join(root, "bootstrap.sh"), "--skip-tools"], root);
  const guardedOutput = `${guarded.stdout}${guarded.stderr}`;
  assert(guarded.status !== 0, "bootstrap refuses non-interactive destructive reset without confirmation");
  assert(guardedOutput.includes("𝗗𝗘𝗦𝗧𝗥𝗨𝗖𝗧𝟭𝗩𝗘 𝗣𝗜 𝗖𝗢𝗗𝟭𝗡𝗚 𝗔𝗚𝗘𝗡𝗧 𝗥𝗘𝗦𝗘𝗧"), "bootstrap warns before destructive reset");
  assert(guardedOutput.includes("Use --yes only if you really mean it"), "bootstrap documents explicit bypass for automation");
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
verifyPackageLockWorkspaceVersions();
verifyPackageManifests();
verifyShellIntegration();
verifyBootstrapDryRun();
verifyWorkflowFiles();

if (failures.length) {
  console.error(`\n${failures.length} verification failure(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nrepo verification ✓");
