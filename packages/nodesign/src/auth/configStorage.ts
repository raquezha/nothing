import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { CredentialProvider, StoreCredentialResult } from "./types.js";

export function configFilePath(): string {
  return path.join(homedir(), ".config", "nodesign", "config.json");
}

export function readConfig(): { figmaToken?: string; zeplinToken?: string } {
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

export function getFromConfig(provider: CredentialProvider): string | undefined {
  const config = readConfig();
  return provider === "figma" ? config.figmaToken : config.zeplinToken;
}

export function writeConfigCredential(provider: CredentialProvider, token: string): StoreCredentialResult {
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
