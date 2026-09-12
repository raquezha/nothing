import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getVersion(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(moduleDir, "..", "..", "package.json");
  return JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "0.0.0";
}

export const VERSION = getVersion();

export const HELP = `nodesign ${VERSION} - deterministic design preflight

Usage:
  nodesign preflight [--json] [--markdown] [--path <dir>] [--task <id>] [--url <design-url>] [--render] [--out <dir>]
  nodesign extract   [--json] [--markdown] [--manifest] [<design-url>] [--url <design-url>] [--find <name>] [--code compose|react|html] [--render] [--out <dir>]
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
  --manifest    Output grounding manifest (mapped local tokens + blueprint)
  --code        Generate starter code (legacy; compose, react, html)
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

export interface ParsedArgs {
  command: "preflight" | "extract" | "auth" | "help" | "version";
  authAction?: "login" | "logout" | "status";
  provider?: "figma" | "zeplin";
  token?: string;
  render?: boolean;
  out?: string;
  find?: string;
  code?: "compose" | "react" | "html";
  manifest?: boolean;
  markdown?: boolean;
  json: boolean;
  path: string;
  task: string;
  url: string;
}

export function fail(message: string): never {
  throw new Error(message);
}

export function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) fail(`Missing value for ${flag}`);
  return value;
}

export function parseProvider(value: string): "figma" | "zeplin" {
  if (value === "figma" || value === "zeplin") return value;
  fail(`Unknown provider: ${value}`);
}
