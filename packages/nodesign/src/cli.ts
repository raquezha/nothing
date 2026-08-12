import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PreflightResult } from "./types.js";
import { formatDesignBrief } from "./brief.js";
import { inspectAndroidProject } from "./android.js";

function getVersion(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(moduleDir, "..", "package.json");
  return JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "0.0.0";
}

const VERSION = getVersion();

const HELP = `nodesign ${VERSION} - deterministic design preflight

Usage:
  nodesign preflight [--json] [--path <dir>] [--task <id>]
  nodesign extract   [--json] [--url <design-url>]
  nodesign auth login
  nodesign --help
  nodesign --version

Commands:
  preflight   Run design preflight checks (default)
  extract     Extract design details from a URL (stub)
  auth login  Store credentials in OS keychain (stub)

Options:
  --json      Output machine-readable JSON
  --path      Project root to inspect (default: cwd)
  --task      Task identifier for the brief
  --help      Show this help
  --version   Show version
`;

interface ParsedArgs {
  command: "preflight" | "extract" | "auth" | "help" | "version";
  json: boolean;
  path: string;
  task: string;
  url: string;
}

function fail(message: string): never {
  throw new Error(message);
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) fail(`Missing value for ${flag}`);
  return value;
}

function validatePath(rootPath: string): string {
  const resolved = path.resolve(rootPath);
  if (!existsSync(resolved)) fail(`Path does not exist: ${rootPath}`);
  if (!statSync(resolved).isDirectory()) fail(`Path is not a directory: ${rootPath}`);
  return resolved;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = {
    command: "preflight",
    json: false,
    path: process.cwd(),
    task: "unknown",
    url: "",
  };

  let i = 0;
  if (args[0] && !args[0].startsWith("-")) {
    const cmd = args[0];
    if (cmd === "preflight" || cmd === "extract") {
      result.command = cmd;
      i = 1;
    } else if (cmd === "auth") {
      if (args[1] !== "login") fail("Only `nodesign auth login` is supported");
      result.command = "auth";
      i = 2;
    } else {
      fail(`Unknown command: ${cmd}`);
    }
  }

  for (; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.command = "help";
    } else if (arg === "--version" || arg === "-v") {
      result.command = "version";
    } else if (arg === "--json") {
      result.json = true;
    } else if (arg === "--path") {
      result.path = requireValue(args, i, "--path");
      i += 1;
    } else if (arg === "--task") {
      result.task = requireValue(args, i, "--task");
      i += 1;
    } else if (arg === "--url") {
      result.url = requireValue(args, i, "--url");
      i += 1;
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }

  if (result.command === "preflight") result.path = validatePath(result.path);
  if (result.command === "extract" && !result.url) fail("Missing value for --url");

  return result;
}

export function run(argv: string[] = process.argv): void {
  try {
    const args = parseArgs(argv);

  switch (args.command) {
    case "help":
      process.stdout.write(HELP);
      return;

    case "version":
      console.log(VERSION);
      return;

    case "auth":
      console.log("nodesign auth: stub - credential storage not yet implemented");
      return;

    case "extract":
      console.log("nodesign extract: stub - design extraction not yet implemented");
      return;

    case "preflight": {
      const inspection = inspectAndroidProject(args.path);
      const preflight: PreflightResult = {
        uiSensitive: inspection.androidUIStack !== "n/a",
        androidUIStack: inspection.androidUIStack,
        evidenceStatus: "missing",
        designLinks: [],
        components: inspection.components,
        notes: inspection.notes,
      };

      const format = args.json ? "json" : "human";
      console.log(formatDesignBrief(args.task, preflight, format));
      return;
    }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`nodesign: ${message}`);
    process.exitCode = 1;
  }
}
