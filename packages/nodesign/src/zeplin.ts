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

export interface ZeplinTypographySpec {
  text?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number;
  lineHeight?: number;
  color?: string;
}

export interface ZeplinLayoutSpec {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  direction?: string;
  gap?: number;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
}

export interface ZeplinNodeSpec {
  name: string;
  type?: string;
  children?: ZeplinNodeSpec[];
}

export interface ZeplinExtractSpec {
  colors: ZeplinColorSpec[];
  typography: ZeplinTypographySpec[];
  layout: ZeplinLayoutSpec;
  hierarchy: ZeplinNodeSpec[];
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
  extract?: ZeplinExtractSpec;
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

function toColorSpec(color: any): ZeplinColorSpec | undefined {
  if (!color || typeof color !== "object") return undefined;
  const r = color.r ?? color.red ?? 0;
  const g = color.g ?? color.green ?? 0;
  const b = color.b ?? color.blue ?? 0;
  const a = color.a ?? color.alpha ?? 1;
  return {
    r,
    g,
    b,
    a,
    hex: color.hex || rgbToHex(r, g, b),
  };
}

function collectColors(node: any, out: ZeplinColorSpec[], seen: Set<string>): void {
  if (!node || typeof node !== "object") return;
  const colorCandidates = [node.color, node.fill, node.backgroundColor, node.textColor];
  for (const candidate of colorCandidates) {
    const spec = toColorSpec(candidate);
    if (!spec) continue;
    const key = `${spec.hex}:${spec.a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(spec);
  }
  if (Array.isArray(node.colors)) {
    for (const color of node.colors) {
      const spec = toColorSpec(color);
      if (!spec) continue;
      const key = `${spec.hex}:${spec.a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(spec);
    }
  }
  if (Array.isArray(node.layers)) {
    for (const layer of node.layers) collectColors(layer, out, seen);
  }
}

function collectTypography(node: any, out: ZeplinTypographySpec[]): void {
  if (!node || typeof node !== "object") return;
  const style = node.textStyles || node.style || node;
  if (node.type === "text" || style.fontFamily || style.fontSize || style.lineHeight) {
    const color = toColorSpec(style.color || node.color);
    out.push({
      text: typeof node.content === "string" ? node.content : typeof node.name === "string" ? node.name : undefined,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      color: color?.hex,
    });
  }
  if (Array.isArray(node.layers)) {
    for (const layer of node.layers) collectTypography(layer, out);
  }
}

function toHierarchy(node: any): ZeplinNodeSpec | undefined {
  if (!node || typeof node !== "object") return undefined;
  const children = Array.isArray(node.layers)
    ? node.layers.map(toHierarchy).filter(Boolean) as ZeplinNodeSpec[]
    : undefined;
  const name = typeof node.name === "string" && node.name ? node.name : typeof node.id === "string" ? node.id : undefined;
  if (!name) return undefined;
  return {
    name,
    type: typeof node.type === "string" ? node.type : undefined,
    ...(children && children.length ? { children } : {}),
  };
}

function extractLayout(data: any): ZeplinLayoutSpec {
  const rect = data?.rect || data?.bounds || {};
  return {
    width: data?.width ?? rect.width,
    height: data?.height ?? rect.height,
    x: rect.x,
    y: rect.y,
    direction: data?.layout?.direction || data?.flexDirection,
    gap: data?.layout?.gap ?? data?.itemSpacing,
    padding: data?.layout?.padding || data?.padding,
  };
}

function extractScreen(data: any, fallbackId: string): ZeplinScreenSpec {
  const colors = (data.colors || []).map(toColorSpec).filter(Boolean) as ZeplinColorSpec[];
  return {
    id: data.id || fallbackId,
    name: data.name || "Untitled Screen",
    width: data.width || 0,
    height: data.height || 0,
    colors,
    layerNames: (data.layers || []).map((l: any) => l.name).filter(Boolean),
  };
}

function extractDetails(data: any, screen: ZeplinScreenSpec): ZeplinExtractSpec {
  const colors = [...screen.colors];
  const seen = new Set(colors.map((c) => `${c.hex}:${c.a}`));
  collectColors(data, colors, seen);
  const typography: ZeplinTypographySpec[] = [];
  collectTypography(data, typography);
  return {
    colors,
    typography,
    layout: extractLayout(data),
    hierarchy: (data.layers || []).map(toHierarchy).filter(Boolean) as ZeplinNodeSpec[],
  };
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
    const screen = extractScreen(data, screenId);
    const extract = extractDetails(data, screen);
    const savedAssets: string[] = [];
    let assets: ZeplinAssetSpec[] = [];

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
            if (!asset.url) continue;
            const fileName = `${asset.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.${asset.format}`;
            const filePath = path.join(outputDir, fileName);
            try {
              const imgRes = await fetchFn(asset.url);
              if (imgRes.ok) {
                const content = await imgRes.text();
                writeFileSync(filePath, content, "utf8");
                savedAssets.push(filePath);
              }
            } catch {}
          }
        }
      }
    } catch {}

    return {
      status: "SUCCESS",
      normalizedStatus: "SUCCESS",
      screen,
      extract,
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
