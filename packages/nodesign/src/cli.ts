import type { PreflightResult } from "./types.js";
import { formatDesignBrief } from "./brief.js";
import { inspectAndroidProject } from "./android.js";

const VERSION = "0.0.1";

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

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // skip node + script
  const result: ParsedArgs = {
    command: "preflight",
    json: false,
    path: process.cwd(),
    task: "unknown",
    url: "",
  };

  let i = 0;
  // First non-flag token is the command
  if (args[0] && !args[0].startsWith("-")) {
    const cmd = args[0];
    if (cmd === "preflight" || cmd === "extract") {
      result.command = cmd;
      i = 1;
    } else if (cmd === "auth") {
      result.command = "auth";
      i = 2; // skip "auth login"
    } else {
      result.command = "preflight";
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
    } else if (arg === "--path" && i + 1 < args.length) {
      result.path = args[++i];
    } else if (arg === "--task" && i + 1 < args.length) {
      result.task = args[++i];
    } else if (arg === "--url" && i + 1 < args.length) {
      result.url = args[++i];
    }
  }

  return result;
}

export function run(argv: string[] = process.argv): void {
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
}
