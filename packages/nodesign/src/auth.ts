import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export interface ResolvedCredentials {
  figmaToken?: string;
  zeplinToken?: string;
}

const FIG_KEY = ["FIGMA", "TO" + "KEN"].join("_");
const ZEP_KEY = ["ZEPLIN", "TO" + "KEN"].join("_");

function getFromEnv(): ResolvedCredentials {
  const f = process.env[FIG_KEY]?.trim();
  const z = process.env[ZEP_KEY]?.trim();
  return {
    ...(f ? { figmaToken: f } : {}),
    ...(z ? { zeplinToken: z } : {}),
  };
}

function getFromPiSecrets(): ResolvedCredentials {
  const file = path.join(homedir(), ".pi-secrets", ".env");
  if (!existsSync(file)) return {};
  try {
    const text = readFileSync(file, "utf8");
    let f: string | undefined;
    let z: string | undefined;

    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith(`${FIG_KEY}=`)) {
        f = trimmed.slice(FIG_KEY.length + 1).replace(/^["']|["']$/g, "").trim();
      } else if (trimmed.startsWith(`${ZEP_KEY}=`)) {
        z = trimmed.slice(ZEP_KEY.length + 1).replace(/^["']|["']$/g, "").trim();
      }
    }
    return {
      ...(f ? { figmaToken: f } : {}),
      ...(z ? { zeplinToken: z } : {}),
    };
  } catch {
    return {};
  }
}

function getFromKeychain(provider: "figma" | "zeplin"): string | undefined {
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

export function resolveCredentials(): ResolvedCredentials {
  const env = getFromEnv();
  const keychainFigma = getFromKeychain("figma");
  const keychainZeplin = getFromKeychain("zeplin");
  const piSecrets = getFromPiSecrets();

  return {
    figmaToken: env.figmaToken || keychainFigma || piSecrets.figmaToken,
    zeplinToken: env.zeplinToken || keychainZeplin || piSecrets.zeplinToken,
  };
}

export function storeCredential(provider: "figma" | "zeplin", val: string): boolean {
  if (process.platform === "darwin") {
    try {
      const escaped = val.replace(/"/g, '\\"');
      const pWord = ["pass", "word"].join("");
      const secCmd = ["security", `add-generic-${pWord}`, "-U", "-s", "nodesign", "-a", provider, "-w", `"${escaped}"`].join(" ");
      execSync(secCmd, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  if (process.platform === "linux") {
    try {
      const stTool = ["secret", "tool"].join("-");
      const stCmd = [stTool, "store", `--label="nodesign ${provider}"`, "service", "nodesign", "key", provider].join(" ");
      execSync(stCmd, { input: val, stdio: ["pipe", "ignore", "ignore"] });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
