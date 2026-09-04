import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveCredentials } from "./auth.js";
import type { ProviderStatus } from "./types.js";

export type ZeplinErrorStatus =
  | "SUCCESS"
  | "AUTH_REQUIRED"
  | "AUTH_REJECTED"
  | "ACCESS_DENIED"
  | "DESIGN_NOT_FOUND"
  | "RATE_LIMITED"
  | "API_UNAVAILABLE";

export interface ZeplinColorSpec {
  r: number;
  g: number;
  b: number;
  a: number;
  hex: string;
}

export interface ZeplinScreenSpec {
  id: string;
  name: string;
  width: number;
  height: number;
  colors: ZeplinColorSpec[];
  layerNames: string[];
}

export interface ZeplinAssetSpec {
  id: string;
  name: string;
  format: string;
  url: string;
}

export interface ZeplinResolutionResult {
  status: ZeplinErrorStatus;
  normalizedStatus: ProviderStatus;
  screen?: ZeplinScreenSpec;
  assets?: ZeplinAssetSpec[];
  savedAssets?: string[];
  note?: string;
}

function normalizeProviderStatus(status: ZeplinErrorStatus): ProviderStatus {
  switch (status) {
    case "AUTH_REJECTED": return "TOKEN_INVALID";
    case "ACCESS_DENIED": return "FILE_FORBIDDEN";
    case "DESIGN_NOT_FOUND": return "NODE_NOT_FOUND";
    default: return status;
  }
}

export function parseZeplinScreenId(urlOrId: string): string {
  const clean = urlOrId.trim();
  if (clean.startsWith("zpl://")) {
    const match = clean.match(/(?:screen\/|screen:)([^/?#]+)/i);
    return match?.[1] || clean.replace(/^zpl:\/\//, "");
  }
  if (clean.includes("zpl.io/")) {
    const parts = clean.split("zpl.io/");
    return parts[1].split(/[?#]/)[0].replace(/\/$/, "");
  }
  if (clean.includes("/screen/")) {
    const parts = clean.split("/screen/");
    return parts[1].split(/[?#]/)[0].replace(/\/$/, "");
  }
  return clean;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export async function resolveZeplinScreen(
  screenUrlOrId: string,
  providedToken?: string,
  outputDir?: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<ZeplinResolutionResult> {
  const screenId = parseZeplinScreenId(screenUrlOrId);
  const authToken = providedToken === undefined ? resolveCredentials().zeplinToken : providedToken || undefined;

  if (!authToken) {
    return {
      status: "AUTH_REQUIRED",
      normalizedStatus: "AUTH_REQUIRED",
      note: "Zeplin access token is missing. Configure ZEPLIN_TOKEN environment variable or run `nodesign auth login`.",
    };
  }

  try {
    const res = await fetchFn(`https://api.zeplin.dev/v1/screens/${screenId}`, {
      headers: {
        "Zeplin-Access-Token": authToken,
      },
    });

    if (res.status === 401) {
      return { status: "AUTH_REJECTED", normalizedStatus: normalizeProviderStatus("AUTH_REJECTED"), note: "Zeplin authentication rejected (401 invalid token)" };
    }
    if (res.status === 403) {
      return { status: "ACCESS_DENIED", normalizedStatus: normalizeProviderStatus("ACCESS_DENIED"), note: "Zeplin access denied (403 forbidden)" };
    }
    if (res.status === 404) {
      return { status: "DESIGN_NOT_FOUND", normalizedStatus: normalizeProviderStatus("DESIGN_NOT_FOUND"), note: `Zeplin screen ${screenId} not found (404)` };
    }
    if (res.status === 429) {
      return { status: "RATE_LIMITED", normalizedStatus: normalizeProviderStatus("RATE_LIMITED"), note: "Zeplin API rate limit exceeded (429)" };
    }
    if (!res.ok) {
      return { status: "API_UNAVAILABLE", normalizedStatus: normalizeProviderStatus("API_UNAVAILABLE"), note: `Zeplin API error (${res.status} ${res.statusText})` };
    }

    const data = (await res.json()) as any;
    const colors: ZeplinColorSpec[] = (data.colors || []).map((c: any) => ({
      r: c.r ?? 0,
      g: c.g ?? 0,
      b: c.b ?? 0,
      a: c.a ?? 1,
      hex: c.hex || rgbToHex(c.r ?? 0, c.g ?? 0, c.b ?? 0),
    }));

    const screen: ZeplinScreenSpec = {
      id: data.id || screenId,
      name: data.name || "Untitled Screen",
      width: data.width || 0,
      height: data.height || 0,
      colors,
      layerNames: (data.layers || []).map((l: any) => l.name).filter(Boolean),
    };

    const savedAssets: string[] = [];
    let assets: ZeplinAssetSpec[] = [];

    // Fetch assets if endpoint is reachable
    try {
      const assetRes = await fetchFn(`https://api.zeplin.dev/v1/screens/${screenId}/assets`, {
        headers: { "Zeplin-Access-Token": authToken },
      });

      if (assetRes.ok) {
        const assetData = (await assetRes.json()) as any[];
        assets = (assetData || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          format: a.format || "svg",
          url: a.url || a.file_url || "",
        }));

        if (outputDir && assets.length > 0) {
          if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
          for (const asset of assets) {
            if (asset.url) {
              const fileName = `${asset.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.${asset.format}`;
              const filePath = path.join(outputDir, fileName);
              try {
                const imgRes = await fetchFn(asset.url);
                if (imgRes.ok) {
                  const content = await imgRes.text();
                  writeFileSync(filePath, content, "utf8");
                  savedAssets.push(filePath);
                }
              } catch {
                // Ignore individual asset download errors
              }
            }
          }
        }
      }
    } catch {
      // Assets fetch is optional
    }

    return {
      status: "SUCCESS",
      normalizedStatus: "SUCCESS",
      screen,
      assets,
      savedAssets,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      status: "API_UNAVAILABLE",
      normalizedStatus: "API_UNAVAILABLE",
      note: `Network or fetch failure querying Zeplin API: ${msg}`,
    };
  }
}
