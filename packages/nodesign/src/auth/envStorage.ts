import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { envKey, type CredentialProvider } from "./types.js";

export function parseEnvText(text: string): Record<string, string> {
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

export function updateEnvFileKey(filePath: string, key: string, value: string): void {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    try { mkdirSync(dir, { recursive: true }); } catch {}
  }

  let text = "";
  if (existsSync(filePath)) {
    try { text = readFileSync(filePath, "utf8"); } catch {}
  }

  const lines = text.length ? text.split("\n") : [];
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

  if (!replaced) {
    if (newLines.length && newLines[newLines.length - 1] === "") {
      newLines.splice(newLines.length - 1, 0, `${key}="${value.replace(/"/g, '\\"')}"`);
    } else {
      newLines.push(`${key}="${value.replace(/"/g, '\\"')}"`);
    }
  }

  try {
    writeFileSync(filePath, newLines.join("\n") + (newLines[newLines.length - 1] === "" ? "" : "\n"), "utf8");
    chmodSync(filePath, 0o600);
  } catch {}
}

export function deleteEnvFileKey(filePath: string, key: string): void {
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

export function readEnvFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  try {
    return parseEnvText(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

export function getFromEnv(provider: CredentialProvider): string | undefined {
  return process.env[envKey(provider)]?.trim() || undefined;
}

export function getFromCwdEnv(provider: CredentialProvider): string | undefined {
  return readEnvFile(path.join(process.cwd(), ".env"))[envKey(provider)]?.trim() || undefined;
}

export function getFromPiSecrets(provider: CredentialProvider): string | undefined {
  return readEnvFile(path.join(homedir(), ".pi-secrets", ".env"))[envKey(provider)]?.trim() || undefined;
}

export function getFromNodesignEnv(provider: CredentialProvider): string | undefined {
  return readEnvFile(path.join(homedir(), ".config", "nodesign", ".env"))[envKey(provider)]?.trim() || undefined;
}
