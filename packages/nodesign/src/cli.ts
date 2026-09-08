import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import readline, { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import type { DesignLink, PreflightResult } from "./types.js";
import { formatAgentDirective, formatDesignBrief, formatTreeBlueprint, parseDesignLink, determineEvidenceStatus } from "./brief.js";
import { inspectAndroidProject, scanColorTokens } from "./android.js";
import { inspectJiraContext, inspectJiraTaskText, extractDesignLinksFromText } from "./jira.js";
import { resolveZeplinScreen } from "./zeplin.js";
import { resolveFigmaLink } from "./figma.js";
import { checkUpdateNotice } from "./update.js";
import { deleteCredential, resolveCredential, storeCredential, validateCredential } from "./auth.js";

import { generateCodeSnippet } from "./code.js";

function getVersion(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(moduleDir, "..", "package.json");
  return JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "0.0.0";
}

const VERSION = getVersion();

const HELP = `nodesign ${VERSION} - deterministic design preflight

Usage:
  nodesign preflight [--json] [--markdown] [--path <dir>] [--task <id>] [--url <design-url>] [--render] [--out <dir>]
  nodesign extract   [--json] [--markdown] [<design-url>] [--url <design-url>] [--find <name>] [--code compose|react|html] [--render] [--out <dir>]
  nodesign auth login [[--provider] figma|zeplin] [[--token] <pat>]
  nodesign auth logout [--provider figma|zeplin]
  nodesign auth status
  nodesign --help
  nodesign --version

Commands:
  preflight     Run design preflight checks (default)
  extract       Extract design details from a URL
  auth login    Store credentials in OS keychain or config file
  auth logout   Clear stored credentials
  auth status   Show credential source and validation status

Options:
  --json        Output machine-readable JSON
  --markdown    Output clean markdown context
  --code        Generate starter code (compose, react, html)
  --find        Find canvas frame/node by name in Figma file
  --render      Download rendered design image(s)
  --out         Output directory for rendered assets
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
  authAction?: "login" | "logout" | "status";
  provider?: "figma" | "zeplin";
  token?: string;
  render?: boolean;
  out?: string;
  find?: string;
  code?: "compose" | "react" | "html";
  markdown?: boolean;
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

async function resolveZeplinLinks(designLinks: DesignLink[], fetchFn: typeof fetch, outputDir?: string) {
  const results = [];

  for (const link of designLinks) {
    if (link.provider !== "zeplin") continue;
    results.push(await resolveZeplinScreen(link.url, undefined, outputDir, fetchFn));
  }

  return results;
}

async function resolveFigmaLinks(designLinks: DesignLink[], fetchFn: typeof fetch, outputDir?: string) {
  const results = [];

  for (const link of designLinks) {
    if (link.provider !== "figma") continue;
    results.push(await resolveFigmaLink(link.url, undefined, outputDir, fetchFn));
  }

  return results;
}

async function selectMenu(
  title: string,
  options: Array<{ label: string; value: "figma" | "zeplin"; hint?: string }>,
): Promise<"figma" | "zeplin"> {
  if (!process.stdin.isTTY) {
    console.log(`\x1b[36m◇\x1b[0m  \x1b[1m${title}\x1b[0m`);
    options.forEach((opt, idx) => console.log(`  ${idx + 1}) ${opt.label}${opt.hint ? ` (${opt.hint})` : ""}`));
    const rl = createInterface({ input, output });
    try {
      const ans = await new Promise<string>((res) => rl.question("\x1b[36m│\x1b[0m  Choice (1-2): ", res));
      const num = parseInt(ans.trim(), 10);
      if (num >= 1 && num <= options.length) return options[num - 1].value;
      return options[0].value;
    } finally {
      rl.close();
    }
  }

  let selectedIndex = 0;
  readline.emitKeypressEvents(input);
  if (process.stdin.setRawMode) process.stdin.setRawMode(true);

  const render = () => {
    output.write("\x1b[?25l");
    output.write(`\x1b[36m◇\x1b[0m  \x1b[1m${title}\x1b[0m \x1b[90m(↑/↓ to navigate, Enter to select)\x1b[0m\n`);
    options.forEach((opt, idx) => {
      const isSelected = idx === selectedIndex;
      const radio = isSelected ? "\x1b[36m●\x1b[0m" : "\x1b[90m○\x1b[0m";
      const labelStr = isSelected ? `\x1b[1m\x1b[36m${opt.label}\x1b[0m` : `\x1b[37m${opt.label}\x1b[0m`;
      const hintStr = opt.hint ? ` \x1b[90m— ${opt.hint}\x1b[0m` : "";
      output.write(`\x1b[36m│\x1b[0m  ${radio} ${labelStr}${hintStr}\n`);
    });
    output.write("\x1b[36m│\x1b[0m\n");
  };

  const clear = () => {
    const totalLines = options.length + 2;
    output.write(`\x1b[${totalLines}A\x1b[J`);
  };

  render();

  return new Promise((resolve) => {
    const onKeypress = (str: string, key: readline.Key) => {
      if (key && key.ctrl && key.name === "c") {
        output.write("\x1b[?25h\x1b[36m└\x1b[0m  \x1b[31mCancelled\x1b[0m\n");
        process.exit(1);
      }

      if (key && (key.name === "up" || key.name === "k")) {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        clear();
        render();
      } else if (key && (key.name === "down" || key.name === "j")) {
        selectedIndex = (selectedIndex + 1) % options.length;
        clear();
        render();
      } else if (key && (key.name === "return" || key.name === "enter" || key.name === "space")) {
        cleanup();
        clear();
        output.write(`\x1b[32m◆\x1b[0m  ${title} \x1b[90m›\x1b[0m \x1b[1m\x1b[32m${options[selectedIndex].label}\x1b[0m\n`);
        resolve(options[selectedIndex].value);
      } else if (str && /^[1-9]$/.test(str)) {
        const num = parseInt(str, 10) - 1;
        if (num >= 0 && num < options.length) {
          selectedIndex = num;
          cleanup();
          clear();
          output.write(`\x1b[32m◆\x1b[0m  ${title} \x1b[90m›\x1b[0m \x1b[1m\x1b[32m${options[selectedIndex].label}\x1b[0m\n`);
          resolve(options[selectedIndex].value);
        }
      }
    };

    const cleanup = () => {
      output.write("\x1b[?25h");
      if (process.stdin.setRawMode) process.stdin.setRawMode(false);
      input.removeListener("keypress", onKeypress);
    };

    input.on("keypress", onKeypress);
  });
}

async function promptAuth(args: ParsedArgs): Promise<{ provider: "figma" | "zeplin"; token: string }> {
  console.log("\n\x1b[36m┌\x1b[0m  \x1b[1m\x1b[36mnodesign auth login\x1b[0m");
  console.log("\x1b[36m│\x1b[0m");

  let provider = args.provider;
  if (!provider) {
    provider = await selectMenu("Select Provider", [
      { label: "Figma", value: "figma", hint: "Personal Access Token (files:read)" },
      { label: "Zeplin", value: "zeplin", hint: "Personal Access Token (Developer Settings)" },
    ]);
  } else {
    console.log(`\x1b[32m◆\x1b[0m  Provider \x1b[90m›\x1b[0m \x1b[1m\x1b[32m${provider}\x1b[0m`);
  }

  console.log("\x1b[36m│\x1b[0m");
  if (provider === "figma") {
    console.log("\x1b[36m◇\x1b[0m  \x1b[1mHow to get a Figma PAT:\x1b[0m");
    console.log("\x1b[36m│\x1b[0m  1. Log in to Figma \x1b[90m→\x1b[0m Profile Avatar \x1b[90m→\x1b[0m \x1b[1mSettings\x1b[0m");
    console.log("\x1b[36m│\x1b[0m  2. Scroll to \x1b[1mPersonal access tokens\x1b[0m \x1b[90m→\x1b[0m \x1b[1mGenerate new token\x1b[0m");
    console.log("\x1b[36m│\x1b[0m  3. Scope: \x1b[32mfiles:read\x1b[0m");
  } else {
    console.log("\x1b[36m◇\x1b[0m  \x1b[1mHow to get a Zeplin Personal Token:\x1b[0m");
    console.log("\x1b[36m│\x1b[0m  1. Log in to Zeplin \x1b[90m→\x1b[0m Avatar \x1b[90m→\x1b[0m \x1b[1mDeveloper Settings\x1b[0m");
    console.log("\x1b[36m│\x1b[0m  2. Click \x1b[1mCreate Personal Access Token\x1b[0m");
  }
  console.log("\x1b[36m│\x1b[0m");

  if (args.token) return { provider, token: args.token };

  const rl = createInterface({ input, output });
  try {
    const token = await new Promise<string>((res) => rl.question("\x1b[36m◇\x1b[0m  \x1b[1mPaste Token (PAT):\x1b[0m ", res));
    const trimmed = token.trim();
    if (!trimmed) fail("Token cannot be empty");
    console.log("\x1b[36m└\x1b[0m  \x1b[32mCredentials submitted\x1b[0m\n");
    return { provider, token: trimmed };
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

          if (args.authAction === "logout") {
            const providers = args.provider ? [args.provider] : (["figma", "zeplin"] as const);
            for (const p of providers) {
              deleteCredential(p);
              console.log(`Cleared stored ${p} token`);
            }
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
          const defaultDir = taskPath ? path.join(taskPath, "evidence") : path.resolve(process.cwd(), "design-renders");
          const outputDir = args.out ? path.resolve(args.out) : args.render ? defaultDir : undefined;
          const zeplin = parsed.link.provider === "zeplin"
            ? await resolveZeplinScreen(parsed.link.url, undefined, outputDir, fetchFn)
            : undefined;
          const figma = parsed.link.provider === "figma"
            ? await resolveFigmaLink(parsed.link.url, undefined, outputDir, fetchFn, args.find)
            : undefined;

          const providerResult = zeplin || figma;
          if (providerResult && providerResult.status !== "SUCCESS") {
            process.exitCode = 1;
          }

          const hierarchy = zeplin?.extract?.hierarchy || figma?.extract?.hierarchy || [];
          const screenName = zeplin?.name || figma?.name || "ExtractedScreen";
          const inspection = inspectAndroidProject(args.path || process.cwd());
          const colorTokens = scanColorTokens(args.path || process.cwd());
          const codeContext = { components: inspection.components, colorTokens, architectureType: inspection.architectureType };
          const archDetailNote = inspection.notes.find((n) => n.startsWith("Project Architecture Structure:")) || inspection.architectureType;

          if (args.json) {
            console.log(JSON.stringify({
              ...parsed,
              directive: formatAgentDirective(screenName, inspection.architectureType, archDetailNote),
              ...(zeplin ? { zeplin } : {}),
              ...(figma ? { figma } : {}),
              ...(args.code ? { code: generateCodeSnippet(hierarchy, args.code, screenName, codeContext) } : {}),
            }, null, 2));
          } else if (args.markdown) {
            console.log(formatAgentDirective(screenName, inspection.architectureType, archDetailNote));
            console.log(`\n# Extracted Design: ${screenName}\n`);
            console.log(`- **Provider**: ${parsed.link.provider}`);
            console.log(`- **URL**: ${parsed.link.url}`);
            console.log(`- **Status**: ${providerResult?.status || parsed.status}`);
            if (hierarchy.length) {
              console.log("\n## UI Blueprint\n```text");
              for (const line of formatTreeBlueprint(hierarchy, 0)) console.log(line);
              console.log("```");
            }
            if (args.code) {
              console.log(`\n## Generated Code (${args.code})\n\`\`\`${args.code === "compose" ? "kotlin" : args.code === "react" ? "tsx" : "html"}`);
              console.log(generateCodeSnippet(hierarchy, args.code, screenName, codeContext));
              console.log("```");
            }
          } else {
            console.log(formatAgentDirective(screenName, inspection.architectureType, archDetailNote));
            console.log(`\nExtracted Design Link: [${parsed.link.provider}] ${parsed.link.url}`);
            console.log(`Status: ${parsed.status}`);
            if (parsed.note) console.log(`Note: ${parsed.note}`);


            if (zeplin) {
              console.log(`Zeplin Resolution: ${zeplin.status}`);
              if (zeplin.screenId) console.log(`Screen ID: ${zeplin.screenId}`);
              if (zeplin.name) console.log(`Name: ${zeplin.name}`);
              if (zeplin.screen) {
                if (zeplin.screen.colors.length) console.log(`Colors: ${zeplin.screen.colors.map((color) => color.hex).join(", ")}`);
              }
              if (zeplin.extract) {
                if (zeplin.extract.typography.length) {
                  console.log(`Typography: ${zeplin.extract.typography.map((t) => `${t.fontFamily || "font"} ${t.fontSize || ""}px`).join(", ")}`);
                }
                if (zeplin.extract.layout.width || zeplin.extract.layout.height) {
                  console.log(`Layout: ${zeplin.extract.layout.width || 0}x${zeplin.extract.layout.height || 0}`);
                }
                if (zeplin.extract.hierarchy.length) {
                  console.log("UI Blueprint:");
                  for (const line of formatTreeBlueprint(zeplin.extract.hierarchy, 1)) {
                    console.log(`  ${line}`);
                  }
                }
              }
              if (zeplin.renderedImage) console.log(`Rendered Image: ${zeplin.renderedImage}`);
              if (zeplin.savedAssets?.length) console.log(`Saved Assets: ${zeplin.savedAssets.join(", ")}`);
              if (zeplin.suggestedScreens?.length) {
                console.log(`Suggested Screens: ${zeplin.suggestedScreens.join(", ")}`);
              }
              if (zeplin.note) console.log(`Zeplin Note: ${zeplin.note}`);
            }
            if (figma) {
              console.log(`Figma Resolution: ${figma.status}`);
              if (figma.fileKey) console.log(`File Key: ${figma.fileKey}${figma.nodeId ? ` (Node ID: ${figma.nodeId})` : ""}`);
              if (figma.name) console.log(`Name: ${figma.name}`);
              if (figma.extract) {
                if (figma.extract.colors.length) console.log(`Colors: ${figma.extract.colors.map((c) => c.hex).join(", ")}`);
                if (figma.extract.typography.length) {
                  console.log(`Typography: ${figma.extract.typography.map((t) => `${t.fontFamily || "font"} ${t.fontSize || ""}px`).join(", ")}`);
                }
                if (figma.extract.layout.width || figma.extract.layout.height) {
                  console.log(`Layout: ${figma.extract.layout.width || 0}x${figma.extract.layout.height || 0}`);
                }
                if (figma.extract.hierarchy.length) {
                  console.log("UI Blueprint:");
                  for (const line of formatTreeBlueprint(figma.extract.hierarchy, 1)) {
                    console.log(`  ${line}`);
                  }
                }
              }
              if (figma.renderedImage) console.log(`Rendered Image: ${figma.renderedImage}`);
              if (figma.suggestedFrames?.length) {
                console.log(`Suggested Frames: ${figma.suggestedFrames.join(", ")}`);
              }
              if (figma.note) console.log(`Figma Note: ${figma.note}`);
            }
            if (args.code && hierarchy.length) {
              console.log(`\nGenerated Code (${args.code}):`);
              console.log(generateCodeSnippet(hierarchy, args.code, screenName, codeContext));
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

          const renderDir = args.out ? path.resolve(args.out) : args.render && taskPath ? path.join(taskPath, "evidence") : undefined;

          const resolvedScreens = await resolveZeplinLinks(designLinks, fetchFn, renderDir);
          for (const screen of resolvedScreens) {
            if (screen.status !== "SUCCESS") notes.push(`Zeplin resolution status: ${screen.status}`);
          }

          const resolvedFigma = await resolveFigmaLinks(designLinks, fetchFn, renderDir);
          for (const fig of resolvedFigma) {
            if (fig.status !== "SUCCESS") notes.push(`Figma resolution status: ${fig.status}`);
          }

          const uiSensitive = inspection.androidUIStack !== "n/a" || designLinks.length > 0;
          const evidenceStatus = determineEvidenceStatus(designLinks, uiSensitive);

          const preflight: PreflightResult = {
            uiSensitive,
            androidUIStack: inspection.androidUIStack,
            architectureType: inspection.architectureType,
            evidenceStatus,
            designLinks,
            resolvedScreens,
            resolvedFigma,
            components: inspection.components,
            notes,
          };


          const format = args.json ? "json" : "human";
          console.log(formatDesignBrief(args.task, preflight, format));

          const updateCheck = await checkUpdateNotice(VERSION, fetchFn);
          if (updateCheck.hasUpdate && updateCheck.notice && !args.json) {
            console.error(`\n${updateCheck.notice}`);
          }
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
