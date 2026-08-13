import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DesignLink, PreflightResult } from "./types.js";
import { formatDesignBrief, parseDesignLink, determineEvidenceStatus } from "./brief.js";
import { inspectAndroidProject } from "./android.js";
import { inspectJiraContext } from "./jira.js";
import { resolveCredentials, storeCredential } from "./auth.js";

function getVersion(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(moduleDir, "..", "package.json");
  return JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "0.0.0";
}

const VERSION = getVersion();

const HELP = `nodesign ${VERSION} - deterministic design preflight

Usage:
  nodesign preflight [--json] [--path <dir>] [--task <id>] [--url <design-url>]
  nodesign extract   [--json] [--url <design-url>]
  nodesign auth login
  nodesign --help
  nodesign --version

Commands:
  preflight   Run design preflight checks (default)
  extract     Extract design details from a URL
  auth login  Store credentials in OS keychain

Options:
  --json      Output machine-readable JSON
  --path      Project root to inspect (default: cwd)
  --task      Task identifier for the brief
  --url       Design URL (Figma, Zeplin)
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
    } else if (arg === "--url" || arg === "--design") {
      result.url = requireValue(args, i, arg);
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

      case "auth": {
        const creds = resolveCredentials();
        const f = creds.figmaToken ? "configured" : "missing";
        const z = creds.zeplinToken ? "configured" : "missing";
        console.log(`nodesign auth: figmaToken=${f}, zeplinToken=${z}`);
        return;
      }

      case "extract": {
        const parsed = parseDesignLink(args.url);
        if (args.json) {
          console.log(JSON.stringify(parsed, null, 2));
        } else {
          console.log(`Extracted Design Link: [${parsed.link.provider}] ${parsed.link.url}`);
          console.log(`Status: ${parsed.status}`);
          if (parsed.note) console.log(`Note: ${parsed.note}`);
        }
        return;
      }

      case "preflight": {
        const inspection = inspectAndroidProject(args.path);
        const designLinks: DesignLink[] = [];
        const notes = [...inspection.notes];

        if (args.url) {
          const parsed = parseDesignLink(args.url);
          designLinks.push(parsed.link);
          if (parsed.note) notes.push(parsed.note);
        }

        if (args.task && args.task !== "unknown") {
          const jiraKey = args.task.startsWith("jira:")
            ? args.task.slice(5)
            : /^[A-Z0-9]+-[0-9]+$/i.test(args.task)
            ? args.task
            : undefined;

          if (jiraKey) {
            const jiraResult = inspectJiraContext(jiraKey);
            for (const link of jiraResult.designLinks) {
              if (!designLinks.some((l) => l.url === link.url)) {
                designLinks.push(link);
              }
            }
            notes.push(...jiraResult.notes);
          }
        }

        const uiSensitive = inspection.androidUIStack !== "n/a" || designLinks.length > 0;
        const evidenceStatus = determineEvidenceStatus(designLinks, uiSensitive);

        const preflight: PreflightResult = {
          uiSensitive,
          androidUIStack: inspection.androidUIStack,
          evidenceStatus,
          designLinks,
          components: inspection.components,
          notes,
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
