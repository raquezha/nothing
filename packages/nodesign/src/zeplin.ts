import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveCredentials, validateCredential, cleanTokenValue, fetchWithRateLimitRetry } from "./auth.js";
import type { ProviderStatus, VisualAnalysis } from "./types.js";
import { renderDesignNode, type RenderResult } from "./render.js";

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
  text?: string;
  color?: string;
  font?: { fontFamily?: string; fontSize?: number; fontWeight?: number | string };
  layout?: ZeplinLayoutSpec;
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
  screenId?: string;
  name?: string;
  screen?: ZeplinScreenSpec;
  extract?: ZeplinExtractSpec;
  assets?: ZeplinAssetSpec[];
  savedAssets?: string[];
  renderedImage?: string;
  rendering?: RenderResult;
  visualAnalysis?: VisualAnalysis;
  suggestedScreens?: string[];
  errorDescription?: string;
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

export function parseZeplinProjectId(url: string): string | undefined {
  const match = url.match(/app\.zeplin\.io\/project\/([a-fA-F0-9]{24})/i) || url.match(/[?&]pid=([a-fA-F0-9]{24})/i);
  return match ? match[1] : undefined;
}

export function parseZeplinScreenId(urlOrId: string): string {
  const clean = urlOrId.trim().replace(/[.,;)\]>]+$/, "");
  const sidMatch = clean.match(/[?&](?:sid|screenId|screen_id|coid|coId)=([^&?#]+)/i);
  if (sidMatch) return sidMatch[1];

  const pidMatch = clean.match(/[?&]pid=([^&?#]+)/i);
  if (pidMatch) return pidMatch[1];

  if (clean.includes("/screen/")) {
    const parts = clean.split("/screen/");
    return parts[1].split(/[?#]/)[0].replace(/\/$/, "");
  }

  const projMatch = clean.match(/app\.zeplin\.io\/project\/([a-fA-F0-9]{24})/i);
  if (projMatch) return projMatch[1];

  if (clean.startsWith("zpl://")) {
    const match = clean.match(/(?:screen\/|screen:|components\/|component:|project\/|project:)([^/?#]+)/i);
    if (match) return match[1];
    return clean.replace(/^zpl:\/\/[^/]*\/?/, "").split(/[?#]/)[0];
  }
  if (clean.includes("zpl.io/")) {
    const parts = clean.split("zpl.io/");
    return parts[1].split(/[?#]/)[0].replace(/\/$/, "");
  }
  return clean;
}


async function fetchSuggestedZeplinScreens(
  authToken: string,
  fetchFn: typeof fetch,
): Promise<string[]> {
  try {
    const zHeaders = { "Zeplin-Access-Token": authToken, Authorization: `Bearer ${authToken}` };
    const projRes = await fetchFn("https://api.zeplin.dev/v1/projects", { headers: zHeaders });
    if (!projRes.ok) return [];
    const projects = (await projRes.json()) as any[];
    const candidates: string[] = [];

    for (const proj of (projects || []).slice(0, 3)) {
      const screensRes = await fetchFn(`https://api.zeplin.dev/v1/projects/${proj.id}/screens?limit=5`, { headers: zHeaders });
      if (screensRes.ok) {
        const screens = (await screensRes.json()) as any[];
        for (const s of screens || []) {
          candidates.push(`${s.name} (${s.id})`);
        }
      }
    }
    return candidates.slice(0, 10);
  } catch {
    return [];
  }
}

export async function resolveZeplinShortlink(
  url: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<string | undefined> {
  const cleanUrl = url.trim().replace(/[.,;)\]>]+$/, "");
  if (!cleanUrl.startsWith("http")) return undefined;

  try {
    const res = await fetchFn(cleanUrl, { method: "HEAD", redirect: "manual" });
    const location = res.headers?.get?.("location") || res.headers?.get?.("Location");
    if (location) {
      const expanded = parseZeplinScreenId(location);
      if (expanded && expanded !== cleanUrl && expanded.length > 5) return expanded;
    }

    const getRes = await fetchFn(cleanUrl, { redirect: "follow" });
    if (getRes.url && getRes.url !== cleanUrl) {
      const expanded = parseZeplinScreenId(getRes.url);
      if (expanded && expanded !== cleanUrl && expanded.length > 5) return expanded;
    }
  } catch {}
  return undefined;
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
  if (node.visible === false || node.hidden === true || node.opacity === 0) return undefined;

  const children = Array.isArray(node.layers)
    ? node.layers.map(toHierarchy).filter(Boolean) as ZeplinNodeSpec[]
    : undefined;

  const name = typeof node.name === "string" && node.name ? node.name : typeof node.id === "string" ? node.id : undefined;
  if (!name) return undefined;

  const style = node.textStyles || node.style || {};
  const colorSpec = toColorSpec(node.color || node.fill || style.color);
  const font = (style.fontFamily || style.fontSize) ? {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
  } : undefined;
  const layout = extractLayout(node);
  const text = typeof node.content === "string" ? node.content : undefined;

  return {
    name,
    type: typeof node.type === "string" ? node.type : undefined,
    ...(text ? { text } : {}),
    ...(colorSpec?.hex ? { color: colorSpec.hex } : {}),
    ...(font ? { font } : {}),
    ...(layout.width || layout.height || layout.direction ? { layout } : {}),
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
  let screenId = parseZeplinScreenId(screenUrlOrId);

  if (!/^[0-9a-fA-F]{24}$/.test(screenId) && (screenUrlOrId.includes("zpl.io") || screenUrlOrId.startsWith("http"))) {
    const targetUrl = screenUrlOrId.startsWith("http") ? screenUrlOrId : `https://zpl.io/${screenId}`;
    const expandedId = await resolveZeplinShortlink(targetUrl, fetchFn);
    if (expandedId) {
      screenId = expandedId;
    }
  }

  const rawToken = providedToken === undefined ? resolveCredentials().zeplinToken : providedToken || undefined;
  const authToken = cleanTokenValue(rawToken);

  if (!authToken) {
    return {
      status: "AUTH_REQUIRED",
      normalizedStatus: "AUTH_REQUIRED",
      note: "Zeplin access token is missing. Configure ZEPLIN_TOKEN environment variable or run `nodesign auth login`.",
    };
  }

  const zHeaders = {
    "Zeplin-Access-Token": authToken,
    Authorization: `Bearer ${authToken}`,
  };

  try {
    let res = await fetchWithRateLimitRetry(`https://api.zeplin.dev/v1/screens/${screenId}`, {
      headers: zHeaders,
    }, fetchFn);

    if (res.status === 404) {
      const compRes = await fetchWithRateLimitRetry(`https://api.zeplin.dev/v1/components/${screenId}`, {
        headers: zHeaders,
      }, fetchFn);
      if (compRes.ok) {
        res = compRes;
      } else {
        const projectId = parseZeplinProjectId(screenUrlOrId) || (screenId.length === 24 ? screenId : undefined);
        if (projectId) {
          const projRes = await fetchWithRateLimitRetry(`https://api.zeplin.dev/v1/projects/${projectId}`, {
            headers: zHeaders,
          }, fetchFn);
          if (projRes.ok) {
            const projData = (await projRes.json()) as any;
            const screensRes = await fetchWithRateLimitRetry(`https://api.zeplin.dev/v1/projects/${projectId}/screens?limit=20`, {
              headers: zHeaders,
            }, fetchFn);
            const projScreens = screensRes.ok ? ((await screensRes.json()) as any[]) : [];
            const candidateNames = projScreens.map((s: any) => `${s.name} (screenId=${s.id})`);

            if (projScreens.length > 0) {
              const firstScreenRes = await fetchWithRateLimitRetry(`https://api.zeplin.dev/v1/screens/${projScreens[0].id}`, {
                headers: zHeaders,
              }, fetchFn);
              if (firstScreenRes.ok) {
                const screenData = (await firstScreenRes.json()) as any;
                const screen = extractScreen(screenData, projScreens[0].id);
                const extract = extractDetails(screenData, screen);
                return {
                  status: "SUCCESS",
                  normalizedStatus: "SUCCESS",
                  screenId: projScreens[0].id,
                  name: screen.name || projData.name,
                  screen,
                  extract,
                  note: `Target screen ${screenId} not found in project ${projectId} ('${projData.name}'). Loaded project dashboard screen context. Candidate screens: ${candidateNames.slice(0, 5).join(", ")}`,
                };
              }
            }
          }
        }
      }
    }

    if (res.status === 401) {
      return { status: "AUTH_REJECTED", normalizedStatus: normalizeProviderStatus("AUTH_REJECTED"), screenId, note: "Zeplin authentication rejected (401 invalid token)" };
    }
    if (res.status === 403) {
      return { status: "ACCESS_DENIED", normalizedStatus: normalizeProviderStatus("ACCESS_DENIED"), screenId, note: "Zeplin access denied (403 forbidden)" };
    }
    if (res.status === 404) {
      const validity = await validateCredential("zeplin", authToken, fetchFn);
      if (validity === "invalid") {
        return { status: "AUTH_REJECTED", normalizedStatus: normalizeProviderStatus("AUTH_REJECTED"), screenId, note: "Zeplin authentication rejected (401 invalid token)" };
      }
      const suggestedScreens = await fetchSuggestedZeplinScreens(authToken, fetchFn);
      const errorDescription = `Zeplin accepted your token, but the requested screen/component ID (${screenId}) does not exist in any project your token can access. The link may be stale, deleted, moved, or copied from another workspace/account.`;
      return {
        status: "DESIGN_NOT_FOUND",
        normalizedStatus: normalizeProviderStatus("DESIGN_NOT_FOUND"),
        screenId,
        suggestedScreens: suggestedScreens.length ? suggestedScreens : undefined,
        errorDescription,
        note: suggestedScreens.length
          ? `${errorDescription} Active screens you can access: ${suggestedScreens.join(", ")}`
          : errorDescription,
      };
    }
    if (res.status === 429) {
      return { status: "RATE_LIMITED", normalizedStatus: normalizeProviderStatus("RATE_LIMITED"), screenId, note: "Zeplin API rate limit exceeded (429)" };
    }
    if (!res.ok) {
      return { status: "API_UNAVAILABLE", normalizedStatus: normalizeProviderStatus("API_UNAVAILABLE"), screenId, note: `Zeplin API error (${res.status} ${res.statusText})` };
    }


    const data = (await res.json()) as any;
    const screen = extractScreen(data, screenId);
    const extract = extractDetails(data, screen);
    const savedAssets: string[] = [];
    let assets: ZeplinAssetSpec[] = [];
    let renderedImage: string | undefined;
    let rendering: RenderResult | undefined;
    let visualAnalysis: VisualAnalysis | undefined;

    if (outputDir) {
      rendering = await renderDesignNode({
        provider: "zeplin",
        fileKeyOrScreenId: screenId,
        authToken,
        outputDir,
      }, fetchFn);

      if (rendering) {
        renderedImage = rendering.savedPath;
        const width = screen.width || 0;
        const layoutType = width > 0 && width < 600 ? "MOBILE_VIEW" : width >= 600 ? "DESKTOP_VIEW" : "COMPONENT_CANVAS";
        const visibleLabels = extract?.typography?.map((t) => t.text).filter(Boolean) as string[] || [];
        const detectedComponents = screen.layerNames || [];

        visualAnalysis = {
          screenshotPath: rendering.savedPath,
          detectedComponents,
          layoutType,
          visibleLabels,
        };
      }
    }



    try {
      const assetRes = await fetchFn(`https://api.zeplin.dev/v1/screens/${screenId}/assets`, {
        headers: zHeaders,
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
      screenId,
      name: screen.name,
      screen,
      extract,
      assets,
      savedAssets,
      renderedImage,
      rendering,
      visualAnalysis,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      status: "API_UNAVAILABLE",
      normalizedStatus: "API_UNAVAILABLE",
      screenId,
      note: `Network or fetch failure querying Zeplin API: ${msg}`,
    };
  }
}
