import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import type { DesignLink, PreflightResult } from "./types.js";
import { formatDesignBrief, parseDesignLink, determineEvidenceStatus } from "./brief.js";
import { inspectAndroidProject } from "./android.js";
import { inspectJiraContext, inspectJiraTaskText, extractDesignLinksFromText } from "./jira.js";
import { resolveZeplinScreen } from "./zeplin.js";
import { resolveFigmaLink } from "./figma.js";
import { resolveCredential, resolveCredentials, storeCredential, validateCredential } from "./auth.js";

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
  nodesign auth login [--provider figma|zeplin] [--token <pat>]
  nodesign auth status
  nodesign --help
  nodesign --version

Commands:
  preflight     Run design preflight checks (default)
  extract       Extract design details from a URL
  auth login    Store credentials in OS keychain or config file
  auth status   Show credential source and validation status

Options:
  --json        Output machine-readable JSON
  --path        Project root to inspect (default: cwd)
  --task        Task identifier for the brief
  --url         Design URL (Figma, Zeplin)
  --provider    Auth provider (figma, zeplin)
  --token       Personal access token for non-interactive auth
  --help        Show this help
  --version     Show version
`;

interface ParsedArgs {
  command: "preflight" | "extract" | "auth" | "help" | "version";
  authAction?: "login" | "status";
  provider?: "figma" | "zeplin";
  token?: string;
  json: boolean;
  path: string;
  task: string;
  url: string;
}

interface RunDeps {
  fetchFn?: typeof fetch;
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

function parseProvider(value: string): "figma" | "zeplin" {
  if (value === "figma" || value === "zeplin") return value;
  fail(`Unknown provider: ${value}`);
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
      if (args[1] !== "login" && args[1] !== "status") fail("Supported auth commands: `nodesign auth login` or `nodesign auth status`");
      result.command = "auth";
      result.authAction = args[1];
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
    } else if (arg === "--provider") {
      result.provider = parseProvider(requireValue(args, i, "--provider"));
      i += 1;
    } else if (arg === "--token") {
      result.token = requireValue(args, i, "--token");
      i += 1;
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }

  if (result.command === "preflight") result.path = validatePath(result.path);
  if (result.command === "extract" && !result.url) fail("Missing value for --url");

  return result;
}

function findWorkflowTaskPath(startDir: string): string | undefined {
  let current = path.resolve(startDir);
  while (true) {
    const activePath = path.join(current, ".workflow", "active.json");
    if (existsSync(activePath)) {
      try {
        const active = JSON.parse(readFileSync(activePath, "utf8"));
        if (active?.taskPath) return path.resolve(current, active.taskPath);
      } catch {
        return undefined;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

async function resolveZeplinLinks(designLinks: DesignLink[], fetchFn: typeof fetch) {
  const taskPath = findWorkflowTaskPath(process.cwd());
  const outputDir = taskPath ? path.join(taskPath, "evidence") : undefined;
  const results = [];

  for (const link of designLinks) {
    if (link.provider !== "zeplin") continue;
    results.push(await resolveZeplinScreen(link.url, undefined, outputDir, fetchFn));
  }

  return results;
}

async function resolveFigmaLinks(designLinks: DesignLink[], fetchFn: typeof fetch) {
  const results = [];

  for (const link of designLinks) {
    if (link.provider !== "figma") continue;
    results.push(await resolveFigmaLink(link.url, undefined, fetchFn));
  }

  return results;
}

async function promptAuth(args: ParsedArgs): Promise<{ provider: "figma" | "zeplin"; token: string }> {
  if (args.provider && args.token) return { provider: args.provider, token: args.token };

  const rl = createInterface({ input, output });
  try {
    let provider = args.provider;
    if (!provider) {
      const answer = (await rl.question("Provider (figma/zeplin): ")).trim().toLowerCase();
      provider = parseProvider(answer);
    }

    if (provider === "figma") {
      console.log("How to get a Figma PAT:");
      console.log("1. Log in to Figma -> Settings");
      console.log("2. Personal access tokens -> Generate new token");
      console.log("3. Scope: files:read");
    } else {
      console.log("How to get a Zeplin Personal Token:");
      console.log("1. Log in to Zeplin -> Developer Settings");
      console.log("2. Create Personal Access Token");
    }

    const token = (args.token || await rl.question("Paste token: ")).trim();
    if (!token) fail("Token cannot be empty");
    return { provider, token };
  } finally {
    rl.close();
  }
}

async function printAuthStatus(fetchFn: typeof fetch): Promise<void> {
  for (const provider of ["figma", "zeplin"] as const) {
    const resolved = resolveCredential(provider);
    if (!resolved.token) {
      console.log(`${provider}: missing`);
      continue;
    }
    const validity = await validateCredential(provider, resolved.token, fetchFn);
    console.log(`${provider}: configured via ${resolved.source}${resolved.location ? ` (${resolved.location})` : ""} - ${validity}`);
  }
}

export function run(argv: string[] = process.argv, deps: RunDeps = {}): void {
  void (async () => {
    try {
      const args = parseArgs(argv);
      const fetchFn = deps.fetchFn || globalThis.fetch;

      switch (args.command) {
        case "help":
          process.stdout.write(HELP);
          return;

        case "version":
          console.log(VERSION);
          return;

        case "auth": {
          if (args.authAction === "status") {
            await printAuthStatus(fetchFn);
            return;
          }

          const creds = await promptAuth(args);
          const stored = storeCredential(creds.provider, creds.token);
          if (!stored.ok) fail(`Could not store ${creds.provider} token`);
          console.log(`Saved ${creds.provider} token to ${stored.source}${stored.location ? ` (${stored.location})` : ""}`);
          return;
        }

        case "extract": {
          const parsed = parseDesignLink(args.url);
          const taskPath = findWorkflowTaskPath(process.cwd());
          const outputDir = taskPath ? path.join(taskPath, "evidence") : undefined;
          const zeplin = parsed.link.provider === "zeplin"
            ? await resolveZeplinScreen(parsed.link.url, undefined, outputDir, fetchFn)
            : undefined;
          const figma = parsed.link.provider === "figma"
            ? await resolveFigmaLink(parsed.link.url, undefined, fetchFn)
            : undefined;

          if (args.json) {
            console.log(JSON.stringify({ ...parsed, ...(zeplin ? { zeplin } : {}), ...(figma ? { figma } : {}) }, null, 2));
          } else {
            console.log(`Extracted Design Link: [${parsed.link.provider}] ${parsed.link.url}`);
            console.log(`Status: ${parsed.status}`);
            if (parsed.note) console.log(`Note: ${parsed.note}`);
            if (zeplin) {
              console.log(`Zeplin Resolution: ${zeplin.status}`);
              if (zeplin.screen) {
                console.log(`Screen: ${zeplin.screen.name} (${zeplin.screen.width}x${zeplin.screen.height})`);
                if (zeplin.screen.colors.length) console.log(`Colors: ${zeplin.screen.colors.map((color) => color.hex).join(", ")}`);
              }
              if (zeplin.savedAssets?.length) console.log(`Saved Assets: ${zeplin.savedAssets.join(", ")}`);
              if (zeplin.note) console.log(`Zeplin Note: ${zeplin.note}`);
            }
            if (figma) {
              console.log(`Figma Resolution: ${figma.status}`);
              if (figma.fileKey) console.log(`File Key: ${figma.fileKey}${figma.nodeId ? ` (Node ID: ${figma.nodeId})` : ""}`);
              if (figma.name) console.log(`Name: ${figma.name}`);
              if (figma.note) console.log(`Figma Note: ${figma.note}`);
            }
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

          const taskPath = findWorkflowTaskPath(args.path);
          if (taskPath && existsSync(taskPath)) {
            const taskLinks: DesignLink[] = [];
            const metaFile = path.join(taskPath, "metadata.json");
            if (existsSync(metaFile)) {
              try {
                const metaText = readFileSync(metaFile, "utf8");
                taskLinks.push(...inspectJiraTaskText(metaText).designLinks);
              } catch {}
            }
            const workFile = path.join(taskPath, "WORK.md");
            if (existsSync(workFile)) {
              try {
                const workText = readFileSync(workFile, "utf8");
                taskLinks.push(...extractDesignLinksFromText(workText));
              } catch {}
            }
            let addedCount = 0;
            for (const link of taskLinks) {
              if (!designLinks.some((l) => l.url === link.url)) {
                designLinks.push(link);
                addedCount++;
              }
            }
            if (addedCount > 0) {
              notes.push(`Discovered ${addedCount} design link(s) in active task workspace`);
            }
          }

          const resolvedScreens = await resolveZeplinLinks(designLinks, fetchFn);
          for (const screen of resolvedScreens) {
            if (screen.status !== "SUCCESS") notes.push(`Zeplin resolution status: ${screen.status}`);
          }

          const resolvedFigma = await resolveFigmaLinks(designLinks, fetchFn);
          for (const fig of resolvedFigma) {
            if (fig.status !== "SUCCESS") notes.push(`Figma resolution status: ${fig.status}`);
          }

          const uiSensitive = inspection.androidUIStack !== "n/a" || designLinks.length > 0;
          const evidenceStatus = determineEvidenceStatus(designLinks, uiSensitive);

          const preflight: PreflightResult = {
            uiSensitive,
            androidUIStack: inspection.androidUIStack,
            evidenceStatus,
            designLinks,
            resolvedScreens,
            resolvedFigma,
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
  })();
}
