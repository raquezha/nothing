import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveCredentials } from "./auth.js";
import type { ProviderStatus } from "./types.js";

export type FigmaErrorStatus =
  | "SUCCESS"
  | "AUTH_REQUIRED"
  | "AUTH_REJECTED"
  | "ACCESS_DENIED"
  | "DESIGN_NOT_FOUND"
  | "RATE_LIMITED"
  | "API_UNAVAILABLE"
  | "AMBIGUOUS_URL";

export interface FigmaColorSpec {
  hex: string;
  opacity?: number;
}

export interface FigmaTypographySpec {
  text?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number;
  lineHeight?: number;
  color?: string;
}

export interface FigmaLayoutSpec {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  direction?: string;
  gap?: number;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
}

export interface FigmaNodeSpec {
  name: string;
  type?: string;
  children?: FigmaNodeSpec[];
}

export interface FigmaExtractSpec {
  colors: FigmaColorSpec[];
  typography: FigmaTypographySpec[];
  layout: FigmaLayoutSpec;
  hierarchy: FigmaNodeSpec[];
}

export interface FigmaResolutionResult {
  status: FigmaErrorStatus;
  normalizedStatus: ProviderStatus;
  url: string;
  fileKey?: string;
  nodeId?: string;
  name?: string;
  extract?: FigmaExtractSpec;
  renderedImage?: string;
  suggestedFrames?: string[];
  note?: string;
}

function normalizeProviderStatus(status: FigmaErrorStatus): ProviderStatus {
  switch (status) {
    case "AUTH_REJECTED": return "TOKEN_INVALID";
    case "ACCESS_DENIED": return "FILE_FORBIDDEN";
    case "DESIGN_NOT_FOUND": return "NODE_NOT_FOUND";
    default: return status;
  }
}

function toByte(value: number | undefined): number {
  return Math.min(255, Math.max(0, Math.round((value ?? 0) * 255)));
}

function rgbaToHex(color: any): string {
  const r = toByte(color?.r);
  const g = toByte(color?.g);
  const b = toByte(color?.b);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
}

function colorFromPaint(paint: any): FigmaColorSpec | undefined {
  if (!paint?.color) return undefined;
  return {
    hex: rgbaToHex(paint.color),
    opacity: paint.opacity,
  };
}

function collectColors(node: any, out: FigmaColorSpec[], seen: Set<string>): void {
  if (!node || typeof node !== "object") return;
  for (const paint of [...(node.fills || []), ...(node.strokes || [])]) {
    const spec = colorFromPaint(paint);
    if (!spec) continue;
    const key = `${spec.hex}:${spec.opacity ?? 1}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(spec);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectColors(child, out, seen);
  }
}

function collectTypography(node: any, out: FigmaTypographySpec[]): void {
  if (!node || typeof node !== "object") return;
  if (node.style?.fontFamily || node.style?.fontSize || node.style?.fontWeight) {
    const fill = Array.isArray(node.fills) ? colorFromPaint(node.fills[0]) : undefined;
    out.push({
      text: typeof node.characters === "string" ? node.characters : undefined,
      fontFamily: node.style.fontFamily,
      fontWeight: node.style.fontWeight,
      fontSize: node.style.fontSize,
      lineHeight: node.style.lineHeightPx,
      color: fill?.hex,
    });
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectTypography(child, out);
  }
}

function toHierarchy(node: any): FigmaNodeSpec | undefined {
  if (!node?.name) return undefined;
  const children = Array.isArray(node.children)
    ? node.children.map(toHierarchy).filter(Boolean) as FigmaNodeSpec[]
    : undefined;
  return {
    name: node.name,
    type: node.type,
    ...(children && children.length ? { children } : {}),
  };
}

function extractLayout(node: any): FigmaLayoutSpec {
  const box = node?.absoluteBoundingBox || {};
  return {
    width: box.width,
    height: box.height,
    x: box.x,
    y: box.y,
    direction: node?.layoutMode,
    gap: node?.itemSpacing,
    padding: {
      top: node?.paddingTop,
      right: node?.paddingRight,
      bottom: node?.paddingBottom,
      left: node?.paddingLeft,
    },
  };
}

function extractDetails(node: any): FigmaExtractSpec {
  const colors: FigmaColorSpec[] = [];
  collectColors(node, colors, new Set());
  const typography: FigmaTypographySpec[] = [];
  collectTypography(node, typography);
  return {
    colors,
    typography,
    layout: extractLayout(node),
    hierarchy: (node?.children || []).map(toHierarchy).filter(Boolean) as FigmaNodeSpec[],
  };
}

async function fetchSuggestedFrames(
  fileKey: string,
  authToken: string,
  fetchFn: typeof fetch,
): Promise<string[]> {
  try {
    const res = await fetchFn(`https://api.figma.com/v1/files/${fileKey}?depth=2`, {
      headers: { "X-Figma-Token": authToken },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const frames: string[] = [];

    const scan = (node: any) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "SECTION") {
        if (typeof node.name === "string" && node.name) {
          frames.push(`${node.name}${node.id ? ` (node-id=${node.id.replace(":", "-")})` : ""}`);
        }
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) scan(child);
      }
    };

    scan(data.document);
    return frames.slice(0, 10);
  } catch {
    return [];
  }
}


export function parseFigmaUrl(urlOrId: string): { fileKey?: string; nodeId?: string } {
  const clean = urlOrId.trim().replace(/[.,;)]+$/, "");
  let fileKey: string | undefined;
  let nodeId: string | undefined;

  const matchKey = clean.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/i);
  if (matchKey) {
    fileKey = matchKey[1];
  }

  const matchNode = clean.match(/[?&](?:node-id|node_id)=([^&]+)/i);
  if (matchNode) {
    nodeId = decodeURIComponent(matchNode[1]).replace("-", ":");
  }

  return { fileKey, nodeId };
}

export async function resolveFigmaLink(
  figmaUrl: string,
  providedToken?: string,
  fetchFn: typeof fetch = globalThis.fetch,
  outputDir?: string,
): Promise<FigmaResolutionResult> {
  const cleanUrl = figmaUrl.trim().replace(/[.,;)]+$/, "");
  const { fileKey, nodeId } = parseFigmaUrl(cleanUrl);

  if (!fileKey) {
    return {
      status: "AMBIGUOUS_URL",
      normalizedStatus: "AMBIGUOUS_URL",
      url: cleanUrl,
      note: "Could not extract Figma file key from URL",
    };
  }

  const authToken = providedToken === undefined ? resolveCredentials().figmaToken : providedToken || undefined;
  if (!authToken) {
    return {
      status: "AUTH_REQUIRED",
      normalizedStatus: "AUTH_REQUIRED",
      url: cleanUrl,
      fileKey,
      nodeId,
      note: "Figma access token is missing. Configure FIGMA_TOKEN environment variable or store in OS keychain/pi-secrets.",
    };
  }

  const queryNodeId = nodeId ? encodeURIComponent(nodeId) : undefined;
  const apiUrl = queryNodeId
    ? `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${queryNodeId}`
    : `https://api.figma.com/v1/files/${fileKey}?depth=1`;

  try {
    const res = await fetchFn(apiUrl, {
      headers: {
        "X-Figma-Token": authToken,
      },
    });

    if (res.status === 401) {
      return { status: "AUTH_REJECTED", normalizedStatus: normalizeProviderStatus("AUTH_REJECTED"), url: cleanUrl, fileKey, nodeId, note: "Figma authentication rejected (401 invalid token)" };
    }
    if (res.status === 403) {
      return { status: "ACCESS_DENIED", normalizedStatus: normalizeProviderStatus("ACCESS_DENIED"), url: cleanUrl, fileKey, nodeId, note: "Figma access denied (403 forbidden)" };
    }
    if (res.status === 404) {
      const suggestedFrames = nodeId && fileKey && authToken ? await fetchSuggestedFrames(fileKey, authToken, fetchFn) : [];
      return {
        status: "DESIGN_NOT_FOUND",
        normalizedStatus: normalizeProviderStatus("DESIGN_NOT_FOUND"),
        url: cleanUrl,
        fileKey,
        nodeId,
        suggestedFrames: suggestedFrames.length ? suggestedFrames : undefined,
        note: suggestedFrames.length
          ? `Figma node ${nodeId} not found. Suggested frames in file ${fileKey}: ${suggestedFrames.join(", ")}`
          : `Figma resource ${fileKey} not found (404)`,
      };
    }
    if (res.status === 429) {
      return { status: "RATE_LIMITED", normalizedStatus: normalizeProviderStatus("RATE_LIMITED"), url: cleanUrl, fileKey, nodeId, note: "Figma API rate limit exceeded (429)" };
    }
    if (!res.ok) {
      return { status: "API_UNAVAILABLE", normalizedStatus: normalizeProviderStatus("API_UNAVAILABLE"), url: cleanUrl, fileKey, nodeId, note: `Figma API error (${res.status} ${res.statusText})` };
    }

    const data = (await res.json()) as any;
    const documentNode = nodeId && data.nodes ? data.nodes[nodeId]?.document : data.document;
    const name = documentNode?.name || data.name;
    let renderedImage: string | undefined;

    if (outputDir && fileKey && nodeId) {
      try {
        const imgRes = await fetchFn(`https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png`, {
          headers: { "X-Figma-Token": authToken },
        });
        if (imgRes.ok) {
          const imgData = (await imgRes.json()) as any;
          const imageUrl = imgData?.images?.[nodeId];
          if (imageUrl) {
            const dlRes = await fetchFn(imageUrl);
            if (dlRes.ok) {
              const buffer = Buffer.from(await dlRes.arrayBuffer());
              if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
              const filePath = path.join(outputDir, `${fileKey}_${nodeId.replace(":", "-")}.png`);
              writeFileSync(filePath, buffer);
              renderedImage = filePath;
            }
          }
        }
      } catch {}
    }

    return {
      status: "SUCCESS",
      normalizedStatus: "SUCCESS",
      url: cleanUrl,
      fileKey,
      nodeId,
      name,
      extract: documentNode ? extractDetails(documentNode) : undefined,
      renderedImage,
      note: nodeId ? undefined : "Validated file reachability, but URL missing node-id parameter for direct frame layout",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      status: "API_UNAVAILABLE",
      normalizedStatus: "API_UNAVAILABLE",
      url: cleanUrl,
      fileKey,
      nodeId,
      note: `Network or fetch failure querying Figma API: ${msg}`,
    };
  }
}
