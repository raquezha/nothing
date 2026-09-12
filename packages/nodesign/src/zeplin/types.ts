import type { ProviderStatus, VisualAnalysis } from "../types.js";
import type { RenderResult } from "../render.js";

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

export function normalizeProviderStatus(status: ZeplinErrorStatus): ProviderStatus {
  switch (status) {
    case "AUTH_REJECTED": return "TOKEN_INVALID";
    case "ACCESS_DENIED": return "FILE_FORBIDDEN";
    case "DESIGN_NOT_FOUND": return "NODE_NOT_FOUND";
    default: return status;
  }
}

export const ZEPLIN_ERROR_DESCRIPTION: Record<Exclude<ZeplinErrorStatus, "SUCCESS">, string> = {
  AUTH_REQUIRED: "No Zeplin token found. Run `nodesign auth login --provider zeplin` or set ZEPLIN_TOKEN.",
  AUTH_REJECTED: "Zeplin token was rejected (401). Your token may be expired or revoked. Run `nodesign auth login --provider zeplin` to update it.",
  ACCESS_DENIED: "Access denied (403). Your Zeplin token is valid, but does not have permission to view this project or organization.",
  DESIGN_NOT_FOUND: "Screen or component not found (404). Check if the link points to a project dashboard instead of a screen, or if the screen was moved/deleted.",
  RATE_LIMITED: "Zeplin rate limit reached (429). Please wait a moment before trying again.",
  API_UNAVAILABLE: "Zeplin API is currently unreachable. Check your internet connection or Zeplin service status.",
};

export function zeplinErrorDescription(status: Exclude<ZeplinErrorStatus, "SUCCESS">, id?: string): string {
  return id && status === "DESIGN_NOT_FOUND"
    ? ZEPLIN_ERROR_DESCRIPTION.DESIGN_NOT_FOUND.replace("screen/component ID", `screen/component ID (${id})`)
    : ZEPLIN_ERROR_DESCRIPTION[status];
}
