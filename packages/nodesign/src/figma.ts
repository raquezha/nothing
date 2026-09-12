import { resolveCredentials, fetchWithRateLimitRetry } from "./auth.js";
import type { VisualAnalysis } from "./types.js";
import { renderDesignNode, type RenderResult } from "./render.js";
import {
  type FigmaResolutionResult,
  normalizeProviderStatus,
  figmaErrorDescription,
} from "./figma/types.js";
import { extractDetails } from "./figma/parser.js";
import { parseFigmaUrl, fetchSuggestedFrames } from "./figma/url.js";

export * from "./figma/types.js";
export { parseFigmaUrl } from "./figma/url.js";

export async function resolveFigmaLink(
  figmaUrl: string,
  providedToken?: string,
  outputDir?: string,
  fetchFn: typeof fetch = globalThis.fetch,
  findName?: string,
): Promise<FigmaResolutionResult> {
  const cleanUrl = figmaUrl.trim().replace(/[.,;)\]>]+$/, "");
  let { fileKey, nodeId } = parseFigmaUrl(cleanUrl);

  if (!fileKey) {
    return {
      status: "AMBIGUOUS_URL",
      normalizedStatus: "AMBIGUOUS_URL",
      url: cleanUrl,
      errorDescription: figmaErrorDescription("AMBIGUOUS_URL"),
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
      errorDescription: figmaErrorDescription("AUTH_REQUIRED"),
      note: "Figma access token is missing. Configure FIGMA_TOKEN environment variable or store in OS keychain/pi-secrets.",
    };
  }

  const primaryNodeId = nodeId ? nodeId.split(",")[0].trim() : undefined;
  let queryNodeId = primaryNodeId ? encodeURIComponent(primaryNodeId) : undefined;

  if (!nodeId && findName) {
    try {
      const searchRes = await fetchFn(`https://api.figma.com/v1/files/${fileKey}?depth=3`, {
        headers: { "X-Figma-Token": authToken },
      });
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as any;
        let matchedId: string | undefined;

        const scanFind = (node: any) => {
          if (!node || typeof node !== "object" || matchedId) return;
          if (typeof node.name === "string" && node.name.toLowerCase().includes(findName.toLowerCase())) {
            matchedId = node.id;
            return;
          }
          if (Array.isArray(node.children)) {
            for (const child of node.children) scanFind(child);
          }
        };

        scanFind(searchData.document);
        if (matchedId) {
          nodeId = matchedId.replace("-", ":");
          queryNodeId = encodeURIComponent(nodeId);
        }
      }
    } catch {}
  }

  const apiUrl = queryNodeId
    ? `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${queryNodeId}`
    : `https://api.figma.com/v1/files/${fileKey}?depth=1`;

  try {
    const res = await fetchWithRateLimitRetry(apiUrl, {
      headers: {
        "X-Figma-Token": authToken,
      },
    }, fetchFn);

    if (res.status === 401) {
      return { status: "AUTH_REJECTED", normalizedStatus: normalizeProviderStatus("AUTH_REJECTED"), url: cleanUrl, fileKey, nodeId, errorDescription: figmaErrorDescription("AUTH_REJECTED"), note: "Figma authentication rejected (401 invalid token)" };
    }
    if (res.status === 403) {
      return { status: "ACCESS_DENIED", normalizedStatus: normalizeProviderStatus("ACCESS_DENIED"), url: cleanUrl, fileKey, nodeId, errorDescription: figmaErrorDescription("ACCESS_DENIED"), note: "Figma access denied (403 forbidden)" };
    }
    if (res.status === 404) {
      const suggestedFrames = nodeId && fileKey && authToken ? await fetchSuggestedFrames(fileKey, authToken, fetchFn) : [];
      const missingId = nodeId || fileKey;
      const errorDescription = figmaErrorDescription("DESIGN_NOT_FOUND", missingId);
      return {
        status: "DESIGN_NOT_FOUND",
        normalizedStatus: normalizeProviderStatus("DESIGN_NOT_FOUND"),
        url: cleanUrl,
        fileKey,
        nodeId,
        suggestedFrames: suggestedFrames.length ? suggestedFrames : undefined,
        errorDescription,
        note: suggestedFrames.length
          ? `${errorDescription} Suggested frames in file ${fileKey}: ${suggestedFrames.join(", ")}`
          : errorDescription,
      };
    }
    if (res.status === 429) {
      return { status: "RATE_LIMITED", normalizedStatus: normalizeProviderStatus("RATE_LIMITED"), url: cleanUrl, fileKey, nodeId, errorDescription: figmaErrorDescription("RATE_LIMITED"), note: "Figma API rate limit exceeded (429)" };
    }
    if (!res.ok) {
      return { status: "API_UNAVAILABLE", normalizedStatus: normalizeProviderStatus("API_UNAVAILABLE"), url: cleanUrl, fileKey, nodeId, errorDescription: figmaErrorDescription("API_UNAVAILABLE"), note: `Figma API error (${res.status} ${res.statusText})` };
    }

    const data = (await res.json()) as any;
    let documentNode: any = undefined;
    if (primaryNodeId && data.nodes) {
      documentNode = data.nodes[primaryNodeId]?.document
        || data.nodes[primaryNodeId.replace(":", "-")]?.document
        || data.nodes[encodeURIComponent(primaryNodeId)]?.document
        || (nodeId ? data.nodes[nodeId]?.document : undefined)
        || (Object.values(data.nodes)[0] as any)?.document;
    } else {
      documentNode = data.document;
    }
    const name = documentNode?.name || data.name;
    const extract = documentNode ? extractDetails(documentNode) : undefined;
    let renderedImage: string | undefined;
    let rendering: RenderResult | undefined;
    let visualAnalysis: VisualAnalysis | undefined;

    const targetRenderId = nodeId || documentNode?.id || (Array.isArray(documentNode?.children) && documentNode.children[0]?.id ? documentNode.children[0].id : undefined);

    if (outputDir && fileKey && targetRenderId) {
      rendering = await renderDesignNode({
        provider: "figma",
        fileKeyOrScreenId: fileKey,
        nodeId: targetRenderId,
        authToken,
        outputDir,
      }, fetchFn);

      if (rendering) {
        renderedImage = rendering.savedPath;
        const width = extract?.layout?.width || 0;
        const layoutType = width > 0 && width < 600 ? "MOBILE_VIEW" : width >= 600 ? "DESKTOP_VIEW" : "COMPONENT_CANVAS";
        const visibleLabels = (extract?.typography?.map((t: any) => t.text).filter(Boolean) as string[]) || [];
        const detectedComponents = (extract?.hierarchy?.map((h: any) => h.name).filter(Boolean) as string[]) || [];

        visualAnalysis = {
          screenshotPath: rendering.savedPath,
          detectedComponents,
          layoutType,
          visibleLabels,
        };
      }
    }

    return {
      status: "SUCCESS",
      normalizedStatus: "SUCCESS",
      url: cleanUrl,
      fileKey,
      nodeId,
      name,
      extract,
      renderedImage,
      rendering,
      visualAnalysis,
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
      errorDescription: figmaErrorDescription("API_UNAVAILABLE"),
      note: `Network or fetch failure querying Figma API: ${msg}`,
    };
  }
}
