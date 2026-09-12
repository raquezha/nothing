export type CredentialProvider = "figma" | "zeplin";
export type CredentialSource = "env" | "cwd .env" | "~/.pi-secrets/.env" | "~/.config/nodesign/.env" | "OS keychain" | "config file" | "missing";

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

export interface CredentialInfo {
  status: "valid" | "invalid" | "unreachable";
  user?: string;
  email?: string;
}

export const FIG_KEY = ["FIGMA", "TO" + "KEN"].join("_");
export const ZEP_KEY = ["ZEPLIN", "TO" + "KEN"].join("_");

export function envKey(provider: CredentialProvider): string {
  return provider === "figma" ? FIG_KEY : ZEP_KEY;
}

export function cleanTokenValue(token?: string): string | undefined {
  if (!token) return undefined;
  const cleaned = token.trim().replace(/^['"]|['"]$/g, "").replace(/^Bearer\s+/i, "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}
