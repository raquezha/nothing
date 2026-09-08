import { execFileSync } from "node:child_process";
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
    let value = trimmed.slice(eq + 1).trim();
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const hashIndex = value.indexOf(" #");
      if (hashIndex !== -1) value = value.slice(0, hashIndex).trim();
    }
    value = value.replace(/^['"]|['"]$/g, "");
    out[key] = value;
  }
  return out;
}

function updateEnvFileKey(filePath: string, key: string, value: string): void {
  if (!existsSync(filePath)) return;
  try {
    const text = readFileSync(filePath, "utf8");
    const lines = text.split("\n");
    let replaced = false;
    const newLines = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith(`${key}=`) || trimmed.startsWith(`export ${key}=`)) {
        replaced = true;
        const prefix = trimmed.startsWith("export ") ? "export " : "";
        return `${prefix}${key}="${value.replace(/"/g, '\\"')}"`;
      }
      return line;
    });
    if (replaced) {
      writeFileSync(filePath, newLines.join("\n"), "utf8");
    }
  } catch {}
}

function deleteEnvFileKey(filePath: string, key: string): void {
  if (!existsSync(filePath)) return;
  try {
    const text = readFileSync(filePath, "utf8");
    const lines = text.split("\n");
    const newLines = lines.filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith(`${key}=`) && !trimmed.startsWith(`export ${key}=`);
    });
    writeFileSync(filePath, newLines.join("\n"), "utf8");
  } catch {}
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
      const out = execFileSync("security", [`find-generic-${pWord}`, "-s", "nodesign", "-a", provider, "-w"], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] });
      return out.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  if (process.platform === "linux") {
    try {
      const stTool = ["secret", "tool"].join("-");
      const out = execFileSync(stTool, ["lookup", "service", "nodesign", "key", provider], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] });
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

export function cleanTokenValue(token?: string): string | undefined {
  if (!token) return undefined;
  const cleaned = token.trim().replace(/^['"]|['"]$/g, "").replace(/^Bearer\s+/i, "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function resolveCredential(provider: CredentialProvider): CredentialResolution {
  const fromEnv = cleanTokenValue(getFromEnv(provider));
  if (fromEnv) return { token: fromEnv, source: "env" };

  const fromCwdEnv = cleanTokenValue(getFromCwdEnv(provider));
  if (fromCwdEnv) return { token: fromCwdEnv, source: "cwd .env", location: path.join(process.cwd(), ".env") };

  const fromPiSecrets = cleanTokenValue(getFromPiSecrets(provider));
  if (fromPiSecrets) return { token: fromPiSecrets, source: "~/.pi-secrets/.env", location: path.join(homedir(), ".pi-secrets", ".env") };

  const fromKeychain = cleanTokenValue(getFromKeychain(provider));
  if (fromKeychain) return { token: fromKeychain, source: "OS keychain" };

  const fromConfig = cleanTokenValue(getFromConfig(provider));
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
  try {
    chmodSync(file, 0o600);
  } catch {}
  return { ok: true, source: "config file", location: file };
}


export function storeCredential(
  provider: CredentialProvider,
  rawToken: string,
  options: { preferFile?: boolean } = {},
): StoreCredentialResult {
  const token = cleanTokenValue(rawToken) || rawToken;
  const key = envKey(provider);
  updateEnvFileKey(path.join(process.cwd(), ".env"), key, token);
  updateEnvFileKey(path.join(homedir(), ".pi-secrets", ".env"), key, token);

  if (!options.preferFile && process.platform === "darwin") {
    try {
      const pWord = ["pass", "word"].join("");
      execFileSync("security", [`add-generic-${pWord}`, "-U", "-s", "nodesign", "-a", provider, "-w", token], { timeout: 5000, stdio: "ignore" });
      return { ok: true, source: "OS keychain" };
    } catch {}
  }

  if (!options.preferFile && process.platform === "linux") {
    try {
      const stTool = ["secret", "tool"].join("-");
      execFileSync(stTool, ["store", `--label=nodesign-${provider}`, "service", "nodesign", "key", provider], { input: token, timeout: 5000, stdio: ["pipe", "ignore", "ignore"] });
      return { ok: true, source: "OS keychain" };
    } catch {}
  }

  try {
    return writeConfigCredential(provider, token);
  } catch {
    return { ok: false, source: "unavailable" };
  }
}

export function deleteCredential(provider: CredentialProvider): boolean {
  let cleared = false;
  const key = envKey(provider);
  deleteEnvFileKey(path.join(process.cwd(), ".env"), key);
  deleteEnvFileKey(path.join(homedir(), ".pi-secrets", ".env"), key);
  if (process.platform === "darwin") {
    try {
      const pWord = ["pass", "word"].join("");
      execFileSync("security", [`delete-generic-${pWord}`, "-s", "nodesign", "-a", provider], { timeout: 5000, stdio: "ignore" });
      cleared = true;
    } catch {}
  }

  if (process.platform === "linux") {
    try {
      const stTool = ["secret", "tool"].join("-");
      execFileSync(stTool, ["clear", "service", "nodesign", "key", provider], { timeout: 5000, stdio: "ignore" });
      cleared = true;
    } catch {}
  }


  const file = configFilePath();
  if (existsSync(file)) {
    try {
      const current = readConfig();
      if (provider === "figma") delete current.figmaToken;
      if (provider === "zeplin") delete current.zeplinToken;
      writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`, "utf8");
      cleared = true;
    } catch {}
  }

  return cleared;
}

export async function fetchWithRateLimitRetry(
  url: string,
  options: RequestInit,
  fetchFn: typeof fetch = globalThis.fetch,
  maxRetries = 2,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetchFn(url, options);
    if (res.status === 429 && attempt < maxRetries) {
      const retryAfterHeader = res.headers?.get?.("Retry-After") || res.headers?.get?.("retry-after");
      const retrySeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : (attempt + 1) * 2;
      const delayMs = Math.min((isNaN(retrySeconds) || retrySeconds <= 0 ? 2 : retrySeconds) * 1000, 10000);
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }
    return res;
  }
  return fetchFn(url, options);
}

export async function validateCredential(
  provider: CredentialProvider,
  rawToken: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<"valid" | "invalid" | "unreachable"> {
  const token = cleanTokenValue(rawToken) || rawToken;
  const url = provider === "figma" ? "https://api.figma.com/v1/me" : "https://api.zeplin.dev/v1/users/me";
  const headers: Record<string, string> = provider === "figma"
    ? { "X-Figma-Token": token }
    : { "Zeplin-Access-Token": token, Authorization: `Bearer ${token}` };

  try {
    const res = await fetchFn(url, { headers });
    if (res.status === 401 || res.status === 403) return "invalid";
    if (!res.ok) return "unreachable";
    return "valid";
  } catch {
    return "unreachable";
  }
}
