import type { ProviderStatus, VisualAnalysis } from "../types.js";
import type { RenderResult } from "../render.js";

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
  text?: string;
  color?: string;
  font?: { fontFamily?: string; fontSize?: number; fontWeight?: number | string };
  layout?: FigmaLayoutSpec;
  variant?: string;
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
  rendering?: RenderResult;
  visualAnalysis?: VisualAnalysis;
  suggestedFrames?: string[];
  errorDescription?: string;
  note?: string;
}

export function normalizeProviderStatus(status: FigmaErrorStatus): ProviderStatus {
  switch (status) {
    case "AUTH_REJECTED": return "TOKEN_INVALID";
    case "ACCESS_DENIED": return "FILE_FORBIDDEN";
    case "DESIGN_NOT_FOUND": return "NODE_NOT_FOUND";
    default: return status;
  }
}

export const FIGMA_ERROR_DESCRIPTION: Record<Exclude<FigmaErrorStatus, "SUCCESS">, string> = {
  AMBIGUOUS_URL: "Unrecognized Figma URL. Make sure the URL includes /design/, /file/, or a valid node-id query parameter.",
  AUTH_REQUIRED: "No Figma token found. Run `nodesign auth login --provider figma` or set FIGMA_TOKEN.",
  AUTH_REJECTED: "Figma token was rejected (401). Your token may be expired or revoked. Run `nodesign auth login --provider figma` to update it.",
  ACCESS_DENIED: "Access denied (403). Your Figma account does not have permission to view this file.",
  DESIGN_NOT_FOUND: "Figma file or node not found (404). Check if the node ID exists in this file or if the file was deleted.",
  RATE_LIMITED: "Figma rate limit reached (429). Please wait a moment before trying again.",
  API_UNAVAILABLE: "Figma API is currently unreachable. Check your internet connection or Figma service status.",
};

export function figmaErrorDescription(status: Exclude<FigmaErrorStatus, "SUCCESS">, id?: string): string {
  return id && status === "DESIGN_NOT_FOUND"
    ? `Figma file or node (${id}) not found (404). Check if the node ID exists in this file or if the file was deleted.`
    : FIGMA_ERROR_DESCRIPTION[status];
}
