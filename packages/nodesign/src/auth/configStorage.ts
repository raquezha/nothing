import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { CredentialProvider, StoreCredentialResult } from "./types.js";

export function configFilePath(): string {
  return path.join(homedir(), ".config", "nodesign", "config.json");
}

function readRawConfig(): Record<string, unknown> {
  const file = configFilePath();
  if (!existsSync(file)) return {};
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

export function readConfig(): { figmaToken?: string; zeplinToken?: string } {
  const data = readRawConfig();
  return {
    ...(typeof data.figmaToken === "string" && data.figmaToken
      ? { figmaToken: data.figmaToken }
      : {}),
    ...(typeof data.zeplinToken === "string" && data.zeplinToken
      ? { zeplinToken: data.zeplinToken }
      : {}),
  };
}

export function getFromConfig(
  provider: CredentialProvider
): string | undefined {
  const config = readConfig();
  return provider === "figma" ? config.figmaToken : config.zeplinToken;
}

export function writeConfigCredential(
  provider: CredentialProvider,
  token: string
): StoreCredentialResult {
  const file = configFilePath();
  const dir = path.dirname(file);
  mkdirSync(dir, { recursive: true });
  // Merge onto full raw config so update-check metadata is preserved.
  const next = {
    ...readRawConfig(),
    ...(provider === "figma" ? { figmaToken: token } : { zeplinToken: token }),
  };
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  try {
    chmodSync(file, 0o600);
  } catch {}
  const verified = getFromConfig(provider);
  if (verified !== token) {
    return { ok: false, source: "unavailable", location: file };
  }
  return { ok: true, source: "config file", location: file };
}

export function clearConfigCredential(provider: CredentialProvider): boolean {
  const file = configFilePath();
  if (!existsSync(file)) return false;
  const current = readRawConfig();
  const key = provider === "figma" ? "figmaToken" : "zeplinToken";
  if (typeof current[key] !== "string" || !current[key]) return false;
  const next = { ...current };
  delete next[key];
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  try {
    chmodSync(file, 0o600);
  } catch {}
  return true;
}
