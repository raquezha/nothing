import { cleanTokenValue, type CredentialProvider, type CredentialInfo } from "./types.js";

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

export async function validateCredentialWithInfo(
  provider: CredentialProvider,
  rawToken: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<CredentialInfo> {
  const token = cleanTokenValue(rawToken) || rawToken;
  const url = provider === "figma" ? "https://api.figma.com/v1/me" : "https://api.zeplin.dev/v1/users/me";
  const headers: Record<string, string> = provider === "figma"
    ? { "X-Figma-Token": token }
    : { "Zeplin-Access-Token": token, Authorization: `Bearer ${token}` };

  try {
    const res = await fetchFn(url, { headers });
    if (res.status === 401 || res.status === 403) return { status: "invalid" };
    if (!res.ok) return { status: "unreachable" };
    try {
      const data = await res.json() as any;
      const user = data.handle || data.username || data.name || undefined;
      const email = data.email || undefined;
      return { status: "valid", user, email };
    } catch {
      return { status: "valid" };
    }
  } catch {
    return { status: "unreachable" };
  }
}

export async function validateCredential(
  provider: CredentialProvider,
  rawToken: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<"valid" | "invalid" | "unreachable"> {
  const info = await validateCredentialWithInfo(provider, rawToken, fetchFn);
  return info.status;
}
