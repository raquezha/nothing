#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
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
  const ignore = new Set(options.ignore ?? [".git", "node_modules", "dist", ".graphify", "vendor"]);
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
    path.join(root, "packages", "workflows", spec),
    path.join(root, spec),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function resolveExtension(spec) {
  const candidates = [
    path.join(root, "packages", spec),
    path.join(root, "packages", "workflows", spec),
    path.join(root, spec),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

async function containsSkillMd(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return false;
  const files = await walk(dir, { ignore: [".git", "node_modules", "dist", ".graphify"] });
  return files.some((file) => path.basename(file) === "SKILL.md");
}

async function verifyMindsets() {
  const mindsets = JSON.parse(readFileSync(path.join(root, "config", "mindsets.json"), "utf8")).mindsets;
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
        const packageJsonPath = path.join(resolved, "package.json");
        assert(existsSync(packageJsonPath), `mindset ${name} extension has package.json: ${extension}`);
        if (existsSync(packageJsonPath)) {
          const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
          const main = typeof pkg.main === "string" ? pkg.main : path.join("dist", `${path.basename(resolved)}.js`);
          assert(existsSync(path.join(resolved, main)), `mindset ${name} extension is built: ${extension}`);
        }
      }
    }
  }
}

function verifyInstallers() {
  const temp = mkdtempSync(path.join(tmpdir(), "nothing-installers-"));
  try {
    const norpivDest = path.join(temp, "norpiv");
    execFileSync("node", [path.join(root, "packages/workflows/norpiv/bin/norpiv-install.cjs"), "--dest", norpivDest, "--copy"], { cwd: root, stdio: "pipe" });
    assert(existsSync(path.join(norpivDest, "refine", "SKILL.md")), "norpiv installer copies refine skill");
    assert(existsSync(path.join(norpivDest, "triage", "SKILL.md")), "norpiv installer copies triage skill");
    assert(!existsSync(path.join(norpivDest, "research", "SKILL.md")), "norpiv installer does not copy local noresearch skill");
    assert(existsSync(path.join(norpivDest, "scripts", "triage_helper.sh")), "norpiv installer copies shared scripts");
    assert(existsSync(path.join(norpivDest, "scripts", "graphify-grill.sh")), "norpiv installer copies Graphify helper");

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

function verifyGraphifyGuardrails() {
  const pythonCheck = run("python3", ["-B", path.join(root, "packages/workflows/norpiv/scripts/test_graphify_grill.py")], root);
  assert(pythonCheck.status === 0, "Graphify helper self-check passes");

  const script = path.join(root, "packages/workflows/norpiv/scripts/graphify-grill.sh");
  const temp = mkdtempSync(path.join(tmpdir(), "nothing-graphify-"));
  try {
    run("git", ["init", "-q"], temp);
    run("git", ["config", "user.email", "test@example.com"], temp);
    run("git", ["config", "user.name", "Test"], temp);
    writeFileSync(path.join(temp, "tracked.txt"), "tracked\n");
    run("git", ["add", "tracked.txt"], temp);
    run("git", ["commit", "-q", "-m", "init"], temp);
    writeFileSync(path.join(temp, ".gitignore"), "ignored.txt\n");
    writeFileSync(path.join(temp, "ignored.txt"), "ignored\n");
    writeFileSync(path.join(temp, "untracked.txt"), "untracked\n");
    const marker = path.join(temp, "checked");
    const fakePython = path.join(temp, "python");
    writeFileSync(fakePython, "#!/usr/bin/env bash\ntest -f \"$2/tracked.txt\" && test ! -e \"$2/ignored.txt\" && test ! -e \"$2/untracked.txt\" && touch \"$CHECK_FILE\"\n");
    chmodSync(fakePython, 0o755);
    const result = run("bash", [script], temp, { env: { ...process.env, GRAPHIFY_PYTHON: fakePython, CHECK_FILE: marker } });
    assert(result.status === 0, "Graphify helper succeeds with committed HEAD archive");
    assert(existsSync(marker), "Graphify input excludes ignored and untracked content");
  } catch (error) {
    fail(`Graphify archive guardrail test failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  const missingTemp = mkdtempSync(path.join(tmpdir(), "nothing-graphify-missing-"));
  try {
    run("git", ["init", "-q"], missingTemp);
    const result = run("bash", [script], missingTemp, { env: { ...process.env, GRAPHIFY_PYTHON: path.join(missingTemp, "missing-python") } });
    assert(result.status === 0, "Graphify helper fails open when unavailable");
    assert(`${result.stdout}${result.stderr}`.includes("Graphify skipped"), "Graphify unavailable warning explains fallback");
  } catch (error) {
    fail(`Graphify fail-open test failed: ${error.message}`);
  } finally {
    rmSync(missingTemp, { recursive: true, force: true });
  }
}

function verifyRpivWorkflowPointer() {
  const script = path.join(root, "packages/workflows/norpiv/scripts/triage_helper.sh");
  const temp = mkdtempSync(path.join(tmpdir(), "nothing-rpiv-workflow-"));
  try {
    run("git", ["init", "-q"], temp);
    run("git", ["config", "user.email", "test@example.com"], temp);
    run("git", ["config", "user.name", "Test"], temp);
    writeFileSync(path.join(temp, "README.md"), "# smoke\n");
    run("git", ["add", "README.md"], temp);
    run("git", ["commit", "-q", "-m", "init"], temp);
    const result = run("bash", [script, "local", "smoke"], temp);
    assert(result.status === 0, "rpiv triage helper creates local task");

    const activeTaskPath = path.join(temp, ".workflow", "active_task.json");
    const activeWorkflowPath = path.join(temp, ".workflow", "active.json");
    assert(!existsSync(activeTaskPath), "rpiv does not dual-write legacy active_task.json");
    assert(existsSync(activeWorkflowPath), "rpiv writes generic active.json");

    const activeWorkflow = JSON.parse(readFileSync(activeWorkflowPath, "utf8"));
    assert(activeWorkflow.workflow === "rpiv", "active_workflow identifies rpiv workflow");
    assert(activeWorkflow.id === "local-smoke", "active_workflow id matches task folder");
    assert(activeWorkflow.taskId === "local-smoke", "active_workflow taskId matches task folder");
    assert(activeWorkflow.stateFile === ".workflow/tasks/local-smoke/WORK.md", "active_workflow points to WORK.md state file");

    const workMd = readFileSync(path.join(temp, ".workflow", "tasks", "local-smoke", "WORK.md"), "utf8");
    assert(workMd.includes("## [INTAKE]"), "rpiv local task writes normalized intake section");
    assert(workMd.includes("## [BRIEF]") && workMd.includes("## [GRILL]") && workMd.includes("## [PLAN]") && workMd.includes("## [LOG]"), "rpiv local task writes guarded workflow sections");
    assert(!workMd.includes("title:\t") && !workMd.includes("state:\t"), "rpiv local task avoids raw tracker cli rendering in WORK.md");
    assert(existsSync(path.join(temp, ".workflow", "tasks", "local-smoke", "evidence")), "rpiv triage helper provisions task evidence directory");
  } catch (error) {
    fail(`rpiv workflow pointer test failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function verifyTaskEvidenceIsolation() {
  const script = path.join(root, "packages/workflows/norpiv/scripts/triage_helper.sh");
  const temp = mkdtempSync(path.join(tmpdir(), "nothing-evidence-isolation-"));
  try {
    run("git", ["init", "-q"], temp);
    run("git", ["config", "user.email", "test@example.com"], temp);
    run("git", ["config", "user.name", "Test"], temp);
    writeFileSync(path.join(temp, "README.md"), "# smoke\n");
    run("git", ["add", "README.md"], temp);
    run("git", ["commit", "-q", "-m", "init"], temp);

    writeFileSync(path.join(temp, "design.png"), "root-design");

    let res = run("bash", [script, "local", "task-a"], temp);
    assert(res.status === 0, "triage helper creates task-a");
    const evidenceDirA = path.join(temp, ".workflow", "tasks", "local-task-a", "evidence");
    assert(existsSync(evidenceDirA), "triage helper provisions evidence/ directory for task-a");
    writeFileSync(path.join(evidenceDirA, "design.png"), "task-a-design");

    res = run("bash", [script, "local", "task-b"], temp);
    assert(res.status === 0, "triage helper creates task-b");
    const evidenceDirB = path.join(temp, ".workflow", "tasks", "local-task-b", "evidence");
    assert(existsSync(evidenceDirB), "triage helper provisions evidence/ directory for task-b");
    writeFileSync(path.join(evidenceDirB, "design.png"), "task-b-design");

    assert(readFileSync(path.join(temp, "design.png"), "utf8") === "root-design", "root design.png is preserved");
    assert(readFileSync(path.join(evidenceDirA, "design.png"), "utf8") === "task-a-design", "task-a evidence design.png is isolated");
    assert(readFileSync(path.join(evidenceDirB, "design.png"), "utf8") === "task-b-design", "task-b evidence design.png is isolated");

    const activeWorkflow = JSON.parse(readFileSync(path.join(temp, ".workflow", "active.json"), "utf8"));
    const activeEvidenceDir = path.join(temp, activeWorkflow.taskPath, "evidence");
    assert(activeEvidenceDir === evidenceDirB, "active task evidence resolves to active task workspace");
    assert(readFileSync(path.join(activeEvidenceDir, "design.png"), "utf8") === "task-b-design", "active task evidence resolution isolates active content");
  } catch (error) {
    fail(`task evidence isolation test failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function verifyResearchWorkflowHelper() {
  const script = path.join(root, "packages/workflows/noresearch/scripts/research_helper.sh");
  const temp = mkdtempSync(path.join(tmpdir(), "nothing-research-workflow-"));
  try {
    run("git", ["init", "-q"], temp);
    run("git", ["config", "user.email", "test@example.com"], temp);
    run("git", ["config", "user.name", "Test"], temp);
    writeFileSync(path.join(temp, "README.md"), "# smoke\n");
    run("git", ["add", "README.md"], temp);
    run("git", ["commit", "-q", "-m", "init"], temp);

    let result = run("bash", [script, "start", "Understand Notrace Storage"], temp);
    assert(result.status === 0, "research helper starts workflow");

    const activeWorkflowPath = path.join(temp, ".workflow", "active.json");
    assert(existsSync(activeWorkflowPath), "research writes generic active.json");
    const activeWorkflow = JSON.parse(readFileSync(activeWorkflowPath, "utf8"));
    assert(activeWorkflow.workflow === "research", "research active.json identifies research workflow");
    assert(activeWorkflow.id === "understand-notrace-storage", "research id is derived from topic");
    assert(activeWorkflow.stateFile === ".workflow/research/understand-notrace-storage/RESEARCH.md", "research active_workflow points to RESEARCH.md");

    const researchMdPath = path.join(temp, ".workflow", "research", "understand-notrace-storage", "RESEARCH.md");
    assert(existsSync(researchMdPath), "research creates RESEARCH.md state file");
    const researchMd = readFileSync(researchMdPath, "utf8");
    assert(researchMd.includes("## [QUESTION]") && researchMd.includes("## [TRACE]"), "research state file has required sections");

    result = run("bash", [script, "log", "Found first useful source"], temp);
    assert(result.status === 0, "research helper logs updates");
    assert(readFileSync(researchMdPath, "utf8").includes("Found first useful source"), "research log entry persisted");

    result = run("bash", [script, "close", "notes/ai/example.md"], temp);
    assert(result.status === 0, "research helper closes workflow");
    assert(!existsSync(activeWorkflowPath), "research close clears active_workflow pointer");
    assert(readFileSync(researchMdPath, "utf8").includes("Artifact: notes/ai/example.md"), "research close links artifact");
    const metadata = JSON.parse(readFileSync(path.join(temp, ".workflow", "research", "understand-notrace-storage", "metadata.json"), "utf8"));
    assert(metadata.status === "closed", "research metadata marked closed");
  } catch (error) {
    fail(`research workflow helper test failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function verifyPackageLockWorkspaceVersions() {
  const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
  const workspaces = ["packages/antigravity", "packages/nofooter", "packages/noheadroom", "packages/noleaks", "packages/nodesign", "packages/workflows/norpiv", "packages/nosearch", "packages/notrace"];
  for (const workspace of workspaces) {
    const pkg = JSON.parse(readFileSync(path.join(root, workspace, "package.json"), "utf8"));
    const lockPkg = lock.packages?.[workspace];
    assert(lockPkg?.version === pkg.version, `package-lock matches ${pkg.name} version`);
  }
}

function verifyPackageManifests() {
  const expected = {
    "packages/antigravity/package.json": { extensions: ["extensions"] },
    "packages/nofooter/package.json": { extensions: ["extensions"] },
    "packages/noleaks/package.json": { extensions: ["extensions"] },
    "packages/noheadroom/package.json": { extensions: ["extensions"] },
    "packages/notrace/package.json": { extensions: ["extensions"] },
    "packages/nosearch/package.json": { extensions: ["extensions"], skills: ["brave-search", "firecrawl"] },
    "packages/workflows/norpiv/package.json": { skills: ["refine", "triage", "frame", "grill-with-docs", "plan", "implement", "verify", "sync", "update-docs", "post-merge-prune", "distill"] },
    "packages/nodesign/package.json": {},
  };

  for (const [file, piManifest] of Object.entries(expected)) {
    const pkg = JSON.parse(readFileSync(path.join(root, file), "utf8"));
    assert(pkg.keywords?.includes("pi-package"), `${file} is tagged as a pi package`);
    const actual = JSON.stringify(pkg.pi);
    const wanted = JSON.stringify(piManifest);
    assert(actual === wanted, actual === wanted ? `${file} declares expected pi resources` : `${file} declares expected pi resources (expected ${wanted}, got ${actual})`);
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
    const fakeAndroid = path.join(fakeBin, "android");
    const fakeDocker = path.join(fakeBin, "docker");
    const argsFile = path.join(temp, "args.txt");
    const installLog = path.join(temp, "installs.txt");
    const cacheDir = path.join(temp, "cache");
    run("mkdir", ["-p", fakeBin], root);
    writeFileSync(fakePi, '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$PI_FAKE_ARGS_FILE"\n');
    writeFileSync(fakeGit, `#!/usr/bin/env bash
set -euo pipefail
printf 'git %s\\n' "$*" >> "$PI_FAKE_INSTALL_LOG"
dest="\${@: -1}"
mkdir -p "$dest/skills/caveman" "$dest/skills/caveman-stats" "$dest/skills/caveman-help"
printf '%s\\n' '---' 'name: caveman' 'description: fake' '---' > "$dest/skills/caveman/SKILL.md"
printf '%s\\n' '---' 'name: caveman-stats' 'description: fake' '---' > "$dest/skills/caveman-stats/SKILL.md"
printf '%s\\n' '---' 'name: caveman-help' 'description: fake' '---' > "$dest/skills/caveman-help/SKILL.md"
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
writeFileSync(fakeAndroid, `#!/usr/bin/env bash
set -euo pipefail
printf 'android %s\n' "$*" >> "$PI_FAKE_INSTALL_LOG"
if [[ "\${1:-}" == "skills" && "\${2:-}" == "add" ]]; then
project=""
while [[ $# -gt 0 ]]; do
case "$1" in
--project=*) project="\${1#--project=}"; shift ;;
--project) project="$2"; shift 2 ;;
*) shift ;;
esac
done
mkdir -p "$project/skills/android-cli"
printf '%s\n' '---' 'name: android-cli' 'description: fake' '---' > "$project/skills/android-cli/SKILL.md"
fi
`);
    writeFileSync(fakeDocker, `#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\n' "$*" >> "$PI_FAKE_INSTALL_LOG"
`);
    chmodSync(fakePi, 0o755);
    chmodSync(fakeGit, 0o755);
    chmodSync(fakeNpm, 0o755);
    chmodSync(fakeAndroid, 0o755);
    chmodSync(fakeDocker, 0o755);

    const env = { ...process.env, PATH: `${fakeBin}:${process.env.PATH}`, PI_FAKE_ARGS_FILE: argsFile, PI_FAKE_INSTALL_LOG: installLog, NOTHING_CACHE_DIR: cacheDir };
    let result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --nothing hello`], root, { env });
    assert(result.status === 0, "bash shell integration runs --nothing with fake pi");
    let args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/) : [];
    assert(args.includes("--system-prompt"), "--nothing overrides the default system prompt");
    assert(args.includes("--no-builtin-tools"), "--nothing disables built-in tools");
    assert(args.includes("--no-prompt-templates"), "--nothing disables prompt templates");
    assert(args.includes("--no-themes"), "--nothing disables themes");
    assert(args.includes("--no-skills") && args.includes("--no-extensions") && args.includes("--no-context-files"), "--nothing disables discovered skills, extensions, and context files");
    assert(!args.includes("--skill"), "--nothing does not add local skills");
    assert(args.includes("--extension") && args.some((arg) => arg.endsWith("/packages/noleaks")), "--nothing keeps the explicit noleaks guard loaded");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi hello`], root, { env });
    assert(result.status === 0, "plain pi remains factory/default under shell integration");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(JSON.stringify(args) === JSON.stringify(["--extension", path.join(root, "packages/noleaks"), "hello"]), "plain pi receives only the explicit noleaks guard plus user args");

    const androidCache = path.join(cacheDir, "android-skills");
    run("mkdir", ["-p", path.join(androidCache, "skills", "android-cli"), path.join(androidCache, "skills", "r8-analyzer")], root);
    writeFileSync(path.join(androidCache, "skills", "android-cli", "SKILL.md"), "---\nname: android-cli\ndescription: fake\n---\n");
    writeFileSync(path.join(androidCache, "skills", "r8-analyzer", "SKILL.md"), "---\nname: r8-analyzer\ndescription: fake\n---\n");
    writeFileSync(path.join(androidCache, ".refreshed-at"), "2026-06-18T00:00:00Z\n");
    writeFileSync(argsFile, "");
    writeFileSync(installLog, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --android hello`], root, { env });
    assert(result.status === 0, "--android loads local cache without network refresh");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(args.some((arg) => arg.endsWith("/android-skills/skills/android-cli")), "--android loads cached android-cli skill");
    assert(args.some((arg) => arg.endsWith("/android-skills/skills/r8-analyzer")), "--android loads cached Android subskill");
    assert(!readFileSync(installLog, "utf8").includes("android"), "--android does not call Android CLI");

    writeFileSync(installLog, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi update`], root, { env });
    assert(result.status === 0, "pi update refreshes managed caches");
    assert(existsSync(path.join(androidCache, "skills", "android-cli", "SKILL.md")), "pi update writes android-cli skill cache");
    const updateLog = readFileSync(installLog, "utf8");
    assert(updateLog.includes("android update"), "pi update runs android update");
    assert(updateLog.includes("android skills add --all"), "pi update installs Android skills into temp project");
    assert(updateLog.includes("git clone") && updateLog.includes("ponytail"), "pi update refreshes Ponytail cache");
    assert(updateLog.includes("git clone") && updateLog.includes("caveman"), "pi update refreshes Caveman cache");
    assert(updateLog.includes("npm install"), "pi update refreshes RTK cache");
    assert(updateLog.includes("docker compose") && updateLog.includes("pull"), "pi update refreshes Headroom image");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --caveman --rtk hello`], root, { env });
    assert(result.status === 0, "caveman and rtk modifiers lazy-install local caches");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(args.filter((arg) => arg === "--skill").length === 2, "--caveman explicitly loads two cached skills");
    assert(args.some((arg) => arg.endsWith("/repos/caveman/skills/caveman")), "--caveman loads cached caveman skill path");
    assert(args.some((arg) => arg.endsWith("/repos/caveman/skills/caveman-help")), "--caveman loads cached caveman-help skill path");
    assert(args.includes("--extension") && args.some((arg) => arg.endsWith("/dotfiles/caveman-stats")), "--caveman loads caveman-stats as an extension directory");
    assert(!args.some((arg) => arg.endsWith("/dotfiles/caveman-stats.ts")), "--caveman does not load caveman-stats with a .ts display name");
    const cavemanStatsSource = readFileSync(path.join(root, "dotfiles/caveman-stats/index.ts"), "utf8");
    assert(cavemanStatsSource.includes("usage.tokens"), "caveman-stats reads Pi ContextUsage.tokens");
    assert(!cavemanStatsSource.includes("inputTokens") && !cavemanStatsSource.includes("outputTokens"), "caveman-stats does not read nonexistent token fields");
    assert(args.includes("--extension") && args.some((arg) => arg.endsWith("/npm/rtk/node_modules/pi-rtk-optimizer")), "--rtk explicitly loads cached RTK optimizer extension");
    const installs = existsSync(installLog) ? readFileSync(installLog, "utf8") : "";
    assert(installs.includes("git clone") && installs.includes("npm install"), "modifiers install into local cache on first use");

    writeFileSync(argsFile, "");
    writeFileSync(installLog, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --caveman --rkt again`], root, { env });
    assert(result.status === 0, "cached caveman and rkt alias run without reinstalling");
    const secondInstalls = existsSync(installLog) ? readFileSync(installLog, "utf8") : "";
    assert(secondInstalls.trim() === "", "modifiers skip install when local cache exists");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --caveman lite --ponytail lite hello`], root, { env });
    assert(result.status === 0, "caveman and ponytail accept optional intensity arguments");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(!args.includes("lite"), "modifier intensity values are consumed instead of forwarded as prompts");
    assert(args[args.length - 1] === "hello", "user prompt remains after consumed modifier intensities");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; NOTHING_HEADROOM_SKIP_START=1 pi --headroom hello`], root, { env });
    assert(result.status === 0, "--headroom runs with backend start skipped in tests");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(args.includes("--extension") && args.some((arg) => arg.endsWith("/packages/noheadroom")), "--headroom loads repo-local noheadroom extension");
    assert(args.includes("--extension") && args.some((arg) => arg.endsWith("/packages/noleaks")), "--headroom keeps noleaks guard loaded");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; NOTHING_HEADROOM_SKIP_START=1 pi --tkmx hello`], root, { env });
    assert(result.status === 0, "--tkmx includes headroom without starting backend in tests");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(args.some((arg) => arg.endsWith("/packages/noheadroom")), "--tkmx loads noheadroom extension");
    assert(args.some((arg) => arg.endsWith("/npm/rtk/node_modules/pi-rtk-optimizer")), "--tkmx loads RTK extension");
    assert(args.some((arg) => arg.endsWith("/repos/caveman/skills/caveman")), "--tkmx loads caveman skill");
    assert(args.some((arg) => arg.endsWith("/packages/antigravity")), "--tkmx loads antigravity extension");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --research hello`], root, { env });
    assert(result.status === 0, "--research runs with fake pi");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(args.some((arg) => arg.endsWith("/packages/workflows/noresearch/research")), "--research loads research skill");
    assert(args.some((arg) => arg.endsWith("/packages/workflows/norpiv/distill")), "--research loads distill skill");
    assert(args.some((arg) => arg.endsWith("/packages/nosearch/brave-search")), "--research loads brave-search skill");
    assert(args.some((arg) => arg.endsWith("/packages/nosearch/firecrawl")), "--research loads firecrawl skill");
    assert(args.some((arg) => arg.endsWith("/packages/notrace")), "--research loads notrace extension");
    assert(args.includes("/research.start hello"), "--research topic rewrites to research.start prompt");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --research "/research.log found source"`], root, { env });
    assert(result.status === 0, "--research explicit slash command runs with fake pi");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(args.includes("/research.log found source"), "--research preserves explicit slash command");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --notes hello`], root, { env });
    assert(result.status === 0, "--notes runs with fake pi");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(args.some((arg) => arg.endsWith("/packages/workflows/norpiv/distill")), "--notes loads distill skill");
    assert(!args.some((arg) => arg.endsWith("/packages/workflows/norpiv/plan")), "--notes does not load full RPIV execution workflow");
    assert(args.includes("hello"), "--notes forwards arguments untouched");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --nochestra hello`], root, { env });
    assert(result.status === 0, "--nochestra runs with fake pi");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(args.some((arg) => arg.endsWith("/packages/workflows/nochestra/nochestra")), "--nochestra loads canonical local nochestra home skill");
    assert(args.includes("hello"), "--nochestra forwards user prompt untouched");

    const nochestraDeliveryEnv = { ...process.env, PI_FAKE_ARGS_FILE: argsFile, PI_FAKE_INSTALL_LOG: installLog, NOTHING_CACHE_DIR: cacheDir };
    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; tmp=$(mktemp -d); cd "$tmp"; git init -b main >/dev/null 2>&1; git config user.name test; git config user.email test@example.com; printf 'node_modules\\n' > .gitignore; git add .gitignore; git commit -m init >/dev/null 2>&1; mkdir -p .workflow; cp ${JSON.stringify(path.join(root, "packages/workflows/nochestra/test/fixtures/checkpoint.json"))} .workflow/nochestra-checkpoint.json; pi --nochestra /triage local:shell-proof`], root, { env: nochestraDeliveryEnv });
    assert(result.status === 0, "--nochestra /triage dispatches through parent runtime");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(args.length === 0, "--nochestra /triage does not call the parent pi chat process");
    assert(result.stdout.includes("Next step: /frame"), "--nochestra /triage prints a compact next action");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --rpiv hello`], root, { env });
    assert(result.status === 0, "--rpiv still runs through normal Pi dispatch");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(args.some((arg) => arg.endsWith("/packages/workflows/norpiv/implement")), "--rpiv still loads RPIV skills");
    assert(args.includes("hello"), "--rpiv still forwards user prompt untouched");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; pi --nochestra-worker --handoff /tmp/handoff.json`], root, { env });
    assert(result.status === 0, "--nochestra-worker runs with fake pi");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(args.some((arg) => arg.endsWith("/packages/workflows/nochestra/nochestra")), "--nochestra-worker loads nochestra skill");
    assert(args.includes("--no-context-files"), "--nochestra-worker disables context files");
    assert(args.includes("--handoff"), "--nochestra-worker forwards canonical --handoff flag");

    writeFileSync(argsFile, "");
    result = run("bash", ["-c", `source ${JSON.stringify(path.join(root, "dotfiles/shell_integration.sh"))}; NOTHING_HEADROOM_SKIP_START=1 pi --meta --tkmx hello`], root, { env });
    assert(result.status === 0, "--meta --tkmx is a valid combination");
    args = existsSync(argsFile) ? readFileSync(argsFile, "utf8").trim().split(/\n/).filter(Boolean) : [];
    assert(args.some((arg) => arg.endsWith("/packages/antigravity")), "--meta --tkmx loads antigravity extension");

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
  const settings = JSON.parse(readFileSync(path.join(root, "config", "settings.json"), "utf8"));
  assert(settings.packages?.includes("npm:pi-mcp-adapter@2.11.0"), "nothing config includes the Pi MCP adapter");
  assert(output.includes("pi install npm:pi-mcp-adapter@2.11.0"), "bootstrap installs the Pi MCP adapter");
  assert(output.includes("Skipping published package install"), "bootstrap skips published package install by default");
  assert(output.includes("Resetting Pi globals so plain 'pi' starts factory-clean"), "bootstrap resets global Pi discovery by default");
  assert(output.includes("~/.agents/skills") || output.includes("/.agents/skills"), "bootstrap warns that generic global skills are reset");
  assert(output.includes("Skipping global skill links"), "bootstrap skips global skill links by default");
  assert(!output.includes("norpiv-install.cjs --target pi"), "bootstrap does not globally install norpiv skills by default");
  assert(!output.includes("nosearch-install.cjs --target pi"), "bootstrap does not globally install nosearch skills by default");
  assert(output.includes("lazy-install local caches"), "bootstrap documents lazy third-party modifier installs");
  assert(output.includes("Provision machine-wide Graphify"), "bootstrap provisions machine-wide Graphify");
  assert(output.includes(`rm -rf ${homedir()}/.graphify/venv`), "bootstrap wipes stale Graphify venv before reinstall");
  assert(output.includes(`${homedir()}/.graphify/venv/bin/python -m pip install --upgrade graphifyy`), "bootstrap installs Graphify into the home environment");
  assert(output.includes("--notes"), "bootstrap documents notes hat");
  assert(output.includes("--research"), "bootstrap documents research hat");
  assert(output.includes("pi update"), "bootstrap documents managed cache refresh command");

  const guarded = run("bash", [path.join(root, "bootstrap.sh"), "--skip-tools"], root);
  const guardedOutput = `${guarded.stdout}${guarded.stderr}`;
  assert(guarded.status !== 0, "bootstrap refuses non-interactive destructive reset without confirmation");
  assert(guardedOutput.includes("𝗗𝗘𝗦𝗧𝗥𝗨𝗖𝗧𝟭𝗩𝗘 𝗣𝗜 𝗖𝗢𝗗𝟭𝗡𝗚 𝗔𝗚𝗘𝗡𝗧 𝗥𝗘𝗦𝗘𝗧"), "bootstrap warns before destructive reset");
  assert(guardedOutput.includes("Use --yes only if you really mean it"), "bootstrap documents explicit bypass for automation");
}

function verifyWorkflowFiles() {
  const refreshScript = readFileSync(path.join(root, "scripts/android-skills-refresh.sh"), "utf8");
  assert(refreshScript.includes("android update"), "Android refresh script explicitly updates Android CLI");
  assert(refreshScript.includes("android skills add --all --project"), "Android refresh script installs skills into a temp project");
  assert(refreshScript.includes("skills/android-cli/SKILL.md"), "Android refresh script verifies android-cli skill cache");
  assert(!existsSync(path.join(root, ".github/workflows/sync-upstream-skills.yml")), "obsolete Android vendor sync workflow removed");
  assert(!existsSync(path.join(root, "vendor/android-skills")), "vendored Android skills snapshot removed");

  const publish = readFileSync(path.join(root, ".github/workflows/publish-packages.yml"), "utf8");
  assert(publish.includes("changesets/action@v1"), "publish workflow uses changesets action");
  assert(!publish.includes("pending_changesets"), "publish workflow does not deadlock on pending changesets");
}

function verifyRpivEvidenceClassificationRules() {
  const frameSkill = readFileSync(path.join(root, "packages/workflows/norpiv/frame/SKILL.md"), "utf8");
  assert(frameSkill.includes("UI-sensitive") && frameSkill.includes("Formula-sensitive") && frameSkill.includes("Backend-safe"), "frame skill defines evidence classification categories");
  assert(frameSkill.includes("present") && frameSkill.includes("missing"), "frame skill defines evidence statuses");

  const grillSkill = readFileSync(path.join(root, "packages/workflows/norpiv/grill-with-docs/SKILL.md"), "utf8");
  assert(grillSkill.includes("zpl.io") && grillSkill.includes("node-id"), "grill skill validates direct Zeplin and Figma links");

  const planSkill = readFileSync(path.join(root, "packages/workflows/norpiv/plan/SKILL.md"), "utf8");
  assert(planSkill.includes("EVIDENCE BLOCKING GATE") && planSkill.includes("BLOCKED: missing UI/formula evidence"), "plan skill enforces evidence blocking gate");
  assert(planSkill.includes("AUTOMATIC NODESIGN PREFLIGHT") && planSkill.includes("nodesign preflight"), "plan skill enforces automatic NoDesign preflight");
  assert(planSkill.includes("HUMAN WAIVER") && planSkill.includes("waived:"), "plan skill documents human waiver recording");

  const implementSkill = readFileSync(path.join(root, "packages/workflows/norpiv/implement/SKILL.md"), "utf8");
  assert(implementSkill.includes("EVIDENCE REJECTION GATE") && implementSkill.includes("refuse code changes"), "implement skill enforces evidence rejection gate");

  const workflowDoc = readFileSync(path.join(root, "docs/workflow.md"), "utf8");
  assert(workflowDoc.includes("Evidence Classification Contract"), "docs/workflow.md documents evidence classification contract");

  const norpivReadme = readFileSync(path.join(root, "packages/workflows/norpiv/README.md"), "utf8");
  assert(norpivReadme.includes("Evidence Classification"), "packages/workflows/norpiv/README.md documents evidence classification");
}

await fileContainsDeprecatedPiNamespace();
await verifyMindsets();
verifyInstallers();
verifyGraphifyGuardrails();
verifyRpivWorkflowPointer();
verifyTaskEvidenceIsolation();
verifyRpivEvidenceClassificationRules();
verifyResearchWorkflowHelper();
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
