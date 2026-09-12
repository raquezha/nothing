import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fail, requireValue, parseProvider, type ParsedArgs } from "./args.js";

export function validatePath(rootPath: string): string {
  const resolved = path.resolve(rootPath);
  if (!existsSync(resolved)) fail(`Path does not exist: ${rootPath}`);
  if (!statSync(resolved).isDirectory()) fail(`Path is not a directory: ${rootPath}`);
  return resolved;
}

export function parseArgs(argv: string[]): ParsedArgs {
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
      if (args[1] !== "login" && args[1] !== "status" && args[1] !== "logout") {
        fail("Supported auth commands: `nodesign auth login`, `nodesign auth logout`, or `nodesign auth status`");
      }
      result.command = "auth";
      result.authAction = args[1] as any;
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
    } else if (arg === "--markdown") {
      result.markdown = true;
    } else if (arg === "--manifest") {
      result.manifest = true;
    } else if (arg === "--find") {
      result.find = requireValue(args, i, "--find");
      i += 1;
    } else if (arg === "--code") {
      const val = requireValue(args, i, "--code").toLowerCase();
      if (val !== "compose" && val !== "react" && val !== "html") fail("Supported --code targets: compose, react, html");
      result.code = val as any;
      i += 1;
    } else if (arg === "--path") {
      result.path = requireValue(args, i, "--path");
      i += 1;
    } else if (arg === "--task") {
      result.task = requireValue(args, i, "--task");
      i += 1;
    } else if (arg === "--url" || arg === "--design") {
      result.url = requireValue(args, i, arg);
      i += 1;
    } else if (arg === "--provider") {
      result.provider = parseProvider(requireValue(args, i, "--provider"));
      i += 1;
    } else if (arg === "--token") {
      result.token = requireValue(args, i, "--token");
      i += 1;
    } else if (result.command === "auth" && !arg.startsWith("-")) {
      if (!result.provider && (arg.toLowerCase() === "figma" || arg.toLowerCase() === "zeplin")) {
        result.provider = parseProvider(arg.toLowerCase());
      } else if (!result.token) {
        result.token = arg;
      } else {
        fail(`Unknown argument: ${arg}`);
      }
    } else if (arg === "--render") {
      result.render = true;
    } else if (arg === "--out") {
      result.out = requireValue(args, i, "--out");
      i += 1;
    } else if (result.command === "extract" && !result.url && !arg.startsWith("-")) {
      result.url = arg;
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }

  if (result.command === "preflight") result.path = validatePath(result.path);
  if (result.command === "extract" && !result.url) fail("Missing value for --url");

  return result;
}
