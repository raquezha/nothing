import { homedir } from "node:os";
import path from "node:path";
import {
  type CredentialProvider,
  type CredentialResolution,
  type ResolvedCredentials,
  type StoreCredentialResult,
  envKey,
  cleanTokenValue,
} from "./auth/types.js";
import {
  getFromEnv,
  getFromCwdEnv,
  getFromPiSecrets,
  getFromNodesignEnv,
  updateEnvFileKey,
  deleteEnvFileKey,
} from "./auth/envStorage.js";
import {
  configFilePath,
  getFromConfig,
  writeConfigCredential,
} from "./auth/configStorage.js";
import {
  getFromKeychain,
  saveToKeychain,
  deleteFromKeychain,
} from "./auth/keychainStorage.js";

export * from "./auth/types.js";
export * from "./auth/validator.js";

export function resolveCredential(provider: CredentialProvider): CredentialResolution {
  const fromEnv = cleanTokenValue(getFromEnv(provider));
  if (fromEnv) return { token: fromEnv, source: "env" };

  const fromCwdEnv = cleanTokenValue(getFromCwdEnv(provider));
  if (fromCwdEnv) return { token: fromCwdEnv, source: "cwd .env", location: path.join(process.cwd(), ".env") };

  const fromPiSecrets = cleanTokenValue(getFromPiSecrets(provider));
  if (fromPiSecrets) return { token: fromPiSecrets, source: "~/.pi-secrets/.env", location: path.join(homedir(), ".pi-secrets", ".env") };

  const fromNodesignEnv = cleanTokenValue(getFromNodesignEnv(provider));
  if (fromNodesignEnv) return { token: fromNodesignEnv, source: "~/.config/nodesign/.env", location: path.join(homedir(), ".config", "nodesign", ".env") };

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

export function storeCredential(
  provider: CredentialProvider,
  rawToken: string,
  options: { preferFile?: boolean } = {},
): StoreCredentialResult {
  const token = cleanTokenValue(rawToken) || rawToken;
  const key = envKey(provider);

  updateEnvFileKey(path.join(process.cwd(), ".env"), key, token);
  updateEnvFileKey(path.join(homedir(), ".pi-secrets", ".env"), key, token);
  updateEnvFileKey(path.join(homedir(), ".config", "nodesign", ".env"), key, token);

  if (!options.preferFile) {
    const saved = saveToKeychain(provider, token);
    if (saved) {
      writeConfigCredential(provider, token);
      return { ok: true, source: "OS keychain" };
    }
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
  deleteEnvFileKey(path.join(homedir(), ".config", "nodesign", ".env"), key);

  if (deleteFromKeychain(provider)) cleared = true;

  const current = getFromConfig(provider);
  if (current) {
    writeConfigCredential(provider, "");
    cleared = true;
  }

  return cleared;
}
