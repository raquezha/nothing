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

export interface FigmaResolutionResult {
  status: FigmaErrorStatus;
  normalizedStatus: ProviderStatus;
  url: string;
  fileKey?: string;
  nodeId?: string;
  name?: string;
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
      return { status: "DESIGN_NOT_FOUND", normalizedStatus: normalizeProviderStatus("DESIGN_NOT_FOUND"), url: cleanUrl, fileKey, nodeId, note: `Figma resource ${fileKey} not found (404)` };
    }
    if (res.status === 429) {
      return { status: "RATE_LIMITED", normalizedStatus: normalizeProviderStatus("RATE_LIMITED"), url: cleanUrl, fileKey, nodeId, note: "Figma API rate limit exceeded (429)" };
    }
    if (!res.ok) {
      return { status: "API_UNAVAILABLE", normalizedStatus: normalizeProviderStatus("API_UNAVAILABLE"), url: cleanUrl, fileKey, nodeId, note: `Figma API error (${res.status} ${res.statusText})` };
    }

    const data = (await res.json()) as any;
    let name: string | undefined = data.name;

    if (nodeId && queryNodeId && data.nodes && data.nodes[nodeId]) {
      name = data.nodes[nodeId]?.document?.name || name;
    }

    return {
      status: "SUCCESS",
      normalizedStatus: "SUCCESS",
      url: cleanUrl,
      fileKey,
      nodeId,
      name,
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
