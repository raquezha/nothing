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
  clearConfigCredential,
} from "./auth/configStorage.js";
import {
  getFromKeychain,
  saveToKeychain,
  deleteFromKeychain,
} from "./auth/keychainStorage.js";

export * from "./auth/types.js";
export * from "./auth/validator.js";

function durableEnvPaths(): { piSecrets: string; nodesignEnv: string } {
  return {
    piSecrets: path.join(homedir(), ".pi-secrets", ".env"),
    nodesignEnv: path.join(homedir(), ".config", "nodesign", ".env"),
  };
}

export function resolveCredential(
  provider: CredentialProvider
): CredentialResolution {
  const fromEnv = cleanTokenValue(getFromEnv(provider));
  if (fromEnv) return { token: fromEnv, source: "env" };

  // Prefer durable home stores over cwd `.env` so a stale project file
  // cannot hide a good login (or make auth look missing outside that repo).
  const fromPiSecrets = cleanTokenValue(getFromPiSecrets(provider));
  if (fromPiSecrets)
    return {
      token: fromPiSecrets,
      source: "~/.pi-secrets/.env",
      location: path.join(homedir(), ".pi-secrets", ".env"),
    };

  const fromNodesignEnv = cleanTokenValue(getFromNodesignEnv(provider));
  if (fromNodesignEnv)
    return {
      token: fromNodesignEnv,
      source: "~/.config/nodesign/.env",
      location: path.join(homedir(), ".config", "nodesign", ".env"),
    };

  // Prefer file-backed config over keychain: macOS keychain often becomes
  // unreadable after reboot/lock, which looked like a spontaneous logout.
  const fromConfig = cleanTokenValue(getFromConfig(provider));
  if (fromConfig)
    return {
      token: fromConfig,
      source: "config file",
      location: configFilePath(),
    };

  const fromKeychain = cleanTokenValue(getFromKeychain(provider));
  if (fromKeychain) return { token: fromKeychain, source: "OS keychain" };

  const fromCwdEnv = cleanTokenValue(getFromCwdEnv(provider));
  if (fromCwdEnv)
    return {
      token: fromCwdEnv,
      source: "cwd .env",
      location: path.join(process.cwd(), ".env"),
    };

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

/**
 * Persist a credential to durable home stores. Success requires at least one
 * verified file-backed write (pi-secrets, nodesign env, or config.json).
 * OS keychain is best-effort only — it can become unreadable after reboot/lock.
 * Cwd `.env` is an optional mirror and never counts toward success.
 */
export function storeCredential(
  provider: CredentialProvider,
  rawToken: string,
  options: { preferFile?: boolean; mirrorCwd?: boolean } = {}
): StoreCredentialResult {
  const token = cleanTokenValue(rawToken) || rawToken;
  const key = envKey(provider);
  const { piSecrets, nodesignEnv } = durableEnvPaths();

  const piOk = updateEnvFileKey(piSecrets, key, token);
  const nodesignEnvOk = updateEnvFileKey(nodesignEnv, key, token);

  let configResult: StoreCredentialResult = {
    ok: false,
    source: "unavailable",
  };
  try {
    configResult = writeConfigCredential(provider, token);
  } catch {
    configResult = { ok: false, source: "unavailable" };
  }

  // Keychain is a bonus cache only; never required and never sole success.
  if (!options.preferFile) {
    saveToKeychain(provider, token);
  }

  // Optional mirror into the calling project; ignored for success.
  if (options.mirrorCwd !== false) {
    updateEnvFileKey(path.join(process.cwd(), ".env"), key, token);
  }

  const fileOk = piOk || nodesignEnvOk || configResult.ok === true;
  if (!fileOk) {
    return { ok: false, source: "unavailable" };
  }

  if (configResult.ok) return configResult;
  if (nodesignEnvOk) {
    return {
      ok: true,
      source: "~/.config/nodesign/.env",
      location: nodesignEnv,
    };
  }
  return { ok: true, source: "~/.pi-secrets/.env", location: piSecrets };
}

export function deleteCredential(provider: CredentialProvider): boolean {
  let cleared = false;
  const key = envKey(provider);
  const { piSecrets, nodesignEnv } = durableEnvPaths();

  if (deleteEnvFileKey(path.join(process.cwd(), ".env"), key)) cleared = true;
  if (deleteEnvFileKey(piSecrets, key)) cleared = true;
  if (deleteEnvFileKey(nodesignEnv, key)) cleared = true;

  if (deleteFromKeychain(provider)) cleared = true;
  if (clearConfigCredential(provider)) cleared = true;

  return cleared;
}
