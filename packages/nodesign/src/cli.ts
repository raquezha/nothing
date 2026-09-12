import { checkUpdateNotice } from "./update.js";
import { VERSION, HELP, parseArgs, type ParsedArgs } from "./cli/index.js";
import { handleExtractCommand } from "./cli/extractCmd.js";
import { handlePreflightCommand } from "./cli/preflightCmd.js";
import { selectMenu } from "./cli/interactive.js";
import { resolveCredential, validateCredentialWithInfo, deleteCredential, storeCredential } from "./auth.js";
import { color } from "./cli/output.js";
import { fail } from "./cli/args.js";
import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";

export { parseArgs };

const TOKEN_URLS = {
  figma: "https://www.figma.com/settings",
  zeplin: "https://app.zeplin.io/profile/developer",
};

interface RunDeps {
  fetchFn?: typeof fetch;
}

async function promptAuth(args: ParsedArgs): Promise<{ provider: "figma" | "zeplin"; token: string }> {
  console.log(`\n${color.cyan}┌${color.reset} ${color.bold}${color.cyan}nodesign auth login${color.reset}`);
  console.log(`${color.cyan}│${color.reset}`);

  let provider = args.provider;
  if (!provider) {
    provider = await selectMenu("Select Provider", [
      { label: "Figma", value: "figma", hint: "Personal Access Token (files:read)" },
      { label: "Zeplin", value: "zeplin", hint: "Personal Access Token (Developer Settings)" },
    ]);
  } else {
    console.log(`${color.green}◆${color.reset}  Provider ${color.dim}›${color.reset} ${color.bold}${color.green}${provider}${color.reset}`);
  }

  console.log(`${color.cyan}│${color.reset}`);
  if (provider === "figma") {
    console.log(`${color.cyan}◇${color.reset}  ${color.bold}Create a Figma PAT:${color.reset}`);
    console.log(`${color.cyan}│${color.reset}  Open: \x1b[4m${color.cyan}${TOKEN_URLS.figma}${color.reset}`);
    console.log(`${color.cyan}│${color.reset}  Then: ${color.bold}Personal access tokens${color.reset} ${color.dim}→${color.reset} ${color.bold}Generate new token${color.reset}`);
    console.log(`${color.cyan}│${color.reset}  Scope: ${color.green}files:read${color.reset}`);
  } else {
    console.log(`${color.cyan}◇${color.reset}  ${color.bold}Create a Zeplin Personal Token:${color.reset}`);
    console.log(`${color.cyan}│${color.reset}  Open: \x1b[4m${color.cyan}${TOKEN_URLS.zeplin}${color.reset}`);
    console.log(`${color.cyan}│${color.reset}  Then click ${color.bold}Create Personal Access Token${color.reset}`);
  }
  console.log(`${color.cyan}│${color.reset}`);

  if (args.token) return { provider, token: args.token };

  const rl = createInterface({ input, output });
  try {
    const token = await new Promise<string>((res) => rl.question(`${color.cyan}◇${color.reset}  ${color.bold}Paste Token (PAT):${color.reset} `, res));
    const trimmed = token.trim();
    if (!trimmed) fail("Token cannot be empty");
    console.log(`${color.cyan}└${color.reset}  ${color.green}Credentials submitted${color.reset}\n`);
    return { provider, token: trimmed };
  } finally {
    rl.close();
  }
}

async function printAuthStatus(fetchFn: typeof fetch): Promise<void> {
  console.log(`\n${color.cyan}┌${color.reset} ${color.bold}${color.cyan}nodesign auth status${color.reset}`);
  console.log(`${color.cyan}│${color.reset}`);
  for (const provider of ["figma", "zeplin"] as const) {
    const resolved = resolveCredential(provider);
    if (!resolved.token) {
      console.log(`${color.yellow}◆${color.reset} ${color.bold}${provider}${color.reset} ${color.dim}›${color.reset} ${color.yellow}missing${color.reset}`);
      console.log(`${color.cyan}│${color.reset}  Run ${color.bold}nodesign auth login${color.reset} to configure`);
      continue;
    }
    const info = await validateCredentialWithInfo(provider, resolved.token, fetchFn);
    const statusIcon = info.status === "valid" ? `${color.green}◆` : info.status === "invalid" ? `${color.red}◆` : `${color.yellow}◆`;
    const statusLabel = info.status === "valid" ? `${color.green}valid${color.reset}` : info.status === "invalid" ? `${color.red}invalid${color.reset}` : `${color.yellow}unreachable${color.reset}`;
    console.log(`${statusIcon}${color.reset} ${color.bold}${provider}${color.reset} ${color.dim}›${color.reset} ${statusLabel}`);
    console.log(`${color.cyan}│${color.reset}  Source: ${resolved.source}${resolved.location ? ` (${resolved.location})` : ""}`);
    if (info.user || info.email) {
      const identity = [info.user, info.email].filter(Boolean).join(" ");
      console.log(`${color.cyan}│${color.reset}  Account: ${color.bold}${identity}${color.reset}`);
    }
    if (info.status === "invalid") {
      console.log(`${color.cyan}│${color.reset}  ${color.red}Token is expired, revoked, or malformed. Run ${color.bold}nodesign auth login${color.reset}${color.red} to replace.${color.reset}`);
    }
  }
  console.log(`${color.cyan}│${color.reset}`);
  console.log(`${color.cyan}└${color.reset}`);
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
            console.log(`\n${color.cyan}┌${color.reset} ${color.bold}${color.cyan}nodesign auth logout${color.reset}`);
            for (const p of providers) {
              deleteCredential(p);
              console.log(`${color.green}◆${color.reset} ${color.bold}${p}${color.reset} ${color.dim}›${color.reset} cleared`);
            }
            console.log(`${color.cyan}└${color.reset}`);
            return;
          }

          const creds = await promptAuth(args);
          console.log(`${color.cyan}│${color.reset}`);
          console.log(`${color.cyan}◇${color.reset} ${color.bold}Validating token...${color.reset}`);
          const info = await validateCredentialWithInfo(creds.provider, creds.token, fetchFn);
          if (info.status === "invalid") {
            console.log(`${color.red}◆${color.reset} ${color.bold}Token rejected${color.reset} ${color.dim}›${color.reset} ${color.red}${creds.provider} API returned 401/403. Check the token and try again.${color.reset}`);
            console.log(`${color.cyan}└${color.reset}`);
            process.exitCode = 1;
            return;
          }
          const stored = storeCredential(creds.provider, creds.token);
          if (!stored.ok) fail(`Could not store ${creds.provider} token`);
          if (info.status === "valid") {
            const identity = [info.user, info.email].filter(Boolean).join(" ");
            console.log(`${color.green}◆${color.reset} ${color.bold}Token valid${color.reset}${identity ? ` ${color.dim}›${color.reset} ${identity}` : ""}`);
          } else {
            console.log(`${color.yellow}◆${color.reset} ${color.bold}Could not verify token${color.reset} ${color.dim}(API unreachable, saved anyway)${color.reset}`);
          }
          console.log(`${color.green}◆${color.reset} Saved to ${color.bold}${stored.source}${color.reset}${stored.location ? ` (${stored.location})` : ""}`);
          console.log(`${color.cyan}└${color.reset}`);
          return;
        }

        case "extract": {
          await handleExtractCommand(args, fetchFn);
          return;
        }

        case "preflight": {
          await handlePreflightCommand(args, fetchFn);
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
