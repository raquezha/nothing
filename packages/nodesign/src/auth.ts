import { execSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export type CredentialProvider = "figma" | "zeplin";
export type CredentialSource = "env" | "cwd .env" | "~/.pi-secrets/.env" | "OS keychain" | "config file" | "missing";

export interface CredentialResolution {
  token?: string;
  source: CredentialSource;
  location?: string;
}

export interface ResolvedCredentials {
  figmaToken?: string;
  zeplinToken?: string;
  figmaSource?: CredentialSource;
  zeplinSource?: CredentialSource;
}

export interface StoreCredentialResult {
  ok: boolean;
  source: "OS keychain" | "config file" | "unavailable";
  location?: string;
}

const FIG_KEY = ["FIGMA", "TO" + "KEN"].join("_");
const ZEP_KEY = ["ZEPLIN", "TO" + "KEN"].join("_");

function envKey(provider: CredentialProvider): string {
  return provider === "figma" ? FIG_KEY : ZEP_KEY;
}

function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    out[key] = value;
  }
  return out;
}

function readEnvFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  try {
    return parseEnvText(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function getFromEnv(provider: CredentialProvider): string | undefined {
  return process.env[envKey(provider)]?.trim() || undefined;
}

function getFromCwdEnv(provider: CredentialProvider): string | undefined {
  return readEnvFile(path.join(process.cwd(), ".env"))[envKey(provider)]?.trim() || undefined;
}

function getFromPiSecrets(provider: CredentialProvider): string | undefined {
  return readEnvFile(path.join(homedir(), ".pi-secrets", ".env"))[envKey(provider)]?.trim() || undefined;
}

function getFromKeychain(provider: CredentialProvider): string | undefined {
  if (process.platform === "darwin") {
    try {
      const pWord = ["pass", "word"].join("");
      const secCmd = ["security", `find-generic-${pWord}`, "-s", "nodesign", "-a", provider, "-w"].join(" ");
      const out = execSync(secCmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      return out.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  if (process.platform === "linux") {
    try {
      const stTool = ["secret", "tool"].join("-");
      const stCmd = [stTool, "lookup", "service", "nodesign", "key", provider].join(" ");
      const out = execSync(stCmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      return out.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function configFilePath(): string {
  return path.join(homedir(), ".config", "nodesign", "config.json");
}

function readConfig(): { figmaToken?: string; zeplinToken?: string } {
  const file = configFilePath();
  if (!existsSync(file)) return {};
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return {
      ...(typeof data?.figmaToken === "string" && data.figmaToken ? { figmaToken: data.figmaToken } : {}),
      ...(typeof data?.zeplinToken === "string" && data.zeplinToken ? { zeplinToken: data.zeplinToken } : {}),
    };
  } catch {
    return {};
  }
}

function getFromConfig(provider: CredentialProvider): string | undefined {
  const config = readConfig();
  return provider === "figma" ? config.figmaToken : config.zeplinToken;
}

export function resolveCredential(provider: CredentialProvider): CredentialResolution {
  const fromEnv = getFromEnv(provider);
  if (fromEnv) return { token: fromEnv, source: "env" };

  const fromCwdEnv = getFromCwdEnv(provider);
  if (fromCwdEnv) return { token: fromCwdEnv, source: "cwd .env", location: path.join(process.cwd(), ".env") };

  const fromPiSecrets = getFromPiSecrets(provider);
  if (fromPiSecrets) return { token: fromPiSecrets, source: "~/.pi-secrets/.env", location: path.join(homedir(), ".pi-secrets", ".env") };

  const fromKeychain = getFromKeychain(provider);
  if (fromKeychain) return { token: fromKeychain, source: "OS keychain" };

  const fromConfig = getFromConfig(provider);
  if (fromConfig) return { token: fromConfig, source: "config file", location: configFilePath() };

  return { source: "missing" };
}

export function resolveCredentials(): ResolvedCredentials {
  const figma = resolveCredential("figma");
  const zeplin = resolveCredential("zeplin");
  return {
    ...(figma.token ? { figmaToken: figma.token } : {}),
    ...(zeplin.token ? { zeplinToken: zeplin.token } : {}),
    figmaSource: figma.source,
    zeplinSource: zeplin.source,
  };
}

function writeConfigCredential(provider: CredentialProvider, token: string): StoreCredentialResult {
  const file = configFilePath();
  const dir = path.dirname(file);
  mkdirSync(dir, { recursive: true });
  const current = readConfig();
  const next = {
    ...current,
    ...(provider === "figma" ? { figmaToken: token } : { zeplinToken: token }),
  };
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  chmodSync(file, 0o600);
  return { ok: true, source: "config file", location: file };
}

export function storeCredential(
  provider: CredentialProvider,
  token: string,
  options: { preferFile?: boolean } = {},
): StoreCredentialResult {
  if (!options.preferFile && process.platform === "darwin") {
    try {
      const escaped = token.replace(/"/g, '\\"');
      const pWord = ["pass", "word"].join("");
      const secCmd = ["security", `add-generic-${pWord}`, "-U", "-s", "nodesign", "-a", provider, "-w", `"${escaped}"`].join(" ");
      execSync(secCmd, { stdio: "ignore" });
      return { ok: true, source: "OS keychain" };
    } catch {}
  }

  if (!options.preferFile && process.platform === "linux") {
    try {
      const stTool = ["secret", "tool"].join("-");
      const stCmd = [stTool, "store", `--label=nodesign-${provider}`, "service", "nodesign", "key", provider].join(" ");
      execSync(stCmd, { input: token, stdio: ["pipe", "ignore", "ignore"] });
      return { ok: true, source: "OS keychain" };
    } catch {}
  }

  try {
    return writeConfigCredential(provider, token);
  } catch {
    return { ok: false, source: "unavailable" };
  }
}

export async function validateCredential(
  provider: CredentialProvider,
  token: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<"valid" | "invalid" | "unreachable"> {
  const url = provider === "figma" ? "https://api.figma.com/v1/me" : "https://api.zeplin.dev/v1/users/me";
  const headers: Record<string, string> = provider === "figma"
    ? { "X-Figma-Token": token }
    : { "Zeplin-Access-Token": token };

  try {
    const res = await fetchFn(url, { headers });
    if (res.status === 401 || res.status === 403) return "invalid";
    if (!res.ok) return "unreachable";
    return "valid";
  } catch {
    return "unreachable";
  }
}
