#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const bundleName = "norpiv";
const sharedDirCandidates = ["scripts"];

function usage() {
  console.log(`Usage: norpiv-install [--target pi|claude|codex|all] [--dest PATH] [--copy] [--force] [--dry-run]

Installs the bundled RPIV skill workflow and shared helper scripts for agent runtimes.

Targets:
  pi      Link skills into ~/.pi/agent/skills (default)
  claude  Link skills into ~/.claude/skills
  codex   Link skills into ~/.codex/skills/norpiv and generate an AGENTS.md adapter
  all     Install all targets

Options:
  --dest PATH  Override target skill directory
  --copy       Copy directories instead of symlinking
  --force      Replace existing paths instead of backing them up
  --dry-run    Print actions without changing files
  --help       Show this help`);
}

function parseArgs(argv) {
  const opts = { target: "pi", dest: "", copy: false, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else if (arg === "--target") {
      opts.target = argv[++i] || "";
    } else if (arg.startsWith("--target=")) {
      opts.target = arg.slice("--target=".length);
    } else if (arg === "--dest") {
      opts.dest = argv[++i] || "";
    } else if (arg.startsWith("--dest=")) {
      opts.dest = arg.slice("--dest=".length);
    } else if (arg === "--copy") {
      opts.copy = true;
    } else if (arg === "--force") {
      opts.force = true;
    } else if (arg === "--dry-run" || arg === "-n") {
      opts.dryRun = true;
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }
  return opts;
}

function skillNames() {
  return fs.readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(packageRoot, name, "SKILL.md")))
    .sort();
}

function sharedDirNames() {
  return sharedDirCandidates.filter((name) => fs.existsSync(path.join(packageRoot, name)));
}

function expandHome(p) {
  if (!p) return p;
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function targetRoot(target, dest) {
  if (dest) return path.resolve(expandHome(dest));
  if (target === "pi") return path.join(os.homedir(), ".pi", "agent", "skills");
  if (target === "claude") return path.join(os.homedir(), ".claude", "skills");
  if (target === "codex") return path.join(os.homedir(), ".codex", "skills", bundleName);
  throw new Error(`Unsupported target: ${target}`);
}

function log(opts, message) {
  console.log(`${opts.dryRun ? "[dry-run] " : ""}${message}`);
}

function rmrf(target, opts) {
  if (opts.dryRun) return;
  fs.rmSync(target, { recursive: true, force: true });
}

function cpdir(src, dest, opts) {
  if (opts.dryRun) return;
  fs.cpSync(src, dest, { recursive: true });
}

function symlinkDir(src, dest, opts) {
  if (opts.dryRun) return;
  fs.symlinkSync(src, dest, "dir");
}

function installOne(src, dest, opts) {
  if (!fs.existsSync(src)) throw new Error(`Missing source: ${src}`);
  log(opts, `install ${src} -> ${dest}${opts.copy ? " (copy)" : " (symlink)"}`);
  if (!opts.dryRun) fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (fs.existsSync(dest)) {
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink()) {
      const current = fs.readlinkSync(dest);
      const resolved = path.resolve(path.dirname(dest), current);
      if (!opts.copy && resolved === src) {
        log(opts, `already linked ${dest}`);
        return;
      }
    }
    if (opts.force) {
      log(opts, `remove existing ${dest}`);
      rmrf(dest, opts);
    } else {
      const backup = `${dest}.backup.${Date.now()}`;
      log(opts, `backup existing ${dest} -> ${backup}`);
      if (!opts.dryRun) fs.renameSync(dest, backup);
    }
  }

  if (opts.copy) cpdir(src, dest, opts);
  else symlinkDir(src, dest, opts);
}

function writeCodexAdapter(root, names, sharedNames, opts) {
  const adapter = path.join(root, "AGENTS.md");
  const sharedLines = sharedNames.length
    ? `\nShared helpers:\n\n${sharedNames.map((name) => `- ${name}/`).join("\n")}\n`
    : "";
  const body = `# norpiv RPIV skills for Codex\n\nCodex does not currently auto-load Pi/Claude SKILL.md bundles from npm.\n\nUse these installed skill instructions as a portable RPIV workflow reference:\n\n${names.map((name) => `- ${name}/SKILL.md`).join("\n")}\n${sharedLines}\nCore lifecycle: triage -> frame -> grill-with-docs -> plan -> implement -> verify -> sync -> post-merge-prune.\n\nIf your Codex environment supports AGENTS.md discovery, copy or reference this file from your project.\n`;
  log(opts, `write Codex adapter ${adapter}`);
  if (!opts.dryRun) fs.writeFileSync(adapter, body);
}

function installTarget(target, opts) {
  const root = targetRoot(target, opts.dest);
  const names = skillNames();
  const sharedNames = sharedDirNames();
  if (!names.length) throw new Error(`No SKILL.md directories found in ${packageRoot}`);
  if (!opts.dryRun) fs.mkdirSync(root, { recursive: true });
  for (const name of names) {
    const src = path.join(packageRoot, name);
    const dest = path.join(root, name);
    installOne(src, dest, opts);
  }
  for (const name of sharedNames) {
    const src = path.join(packageRoot, name);
    const dest = path.join(root, name);
    installOne(src, dest, opts);
  }
  if (target === "codex") writeCodexAdapter(root, names, sharedNames, opts);
  console.log(`Installed ${bundleName} skills for ${target} at ${root}`);
}

const opts = parseArgs(process.argv.slice(2));
const targets = opts.target === "all" ? ["pi", "claude", "codex"] : [opts.target];
for (const target of targets) installTarget(target, opts);
