export function parseFigmaUrl(urlOrId: string): { fileKey?: string; nodeId?: string } {
  const clean = urlOrId.trim().replace(/[.,;)\]>]+$/, "");
  let fileKey: string | undefined;
  let nodeId: string | undefined;

  const matchKey = clean.match(/figma\.com\/(?:file|design|proto|board)\/([a-zA-Z0-9_-]+)/i);
  if (matchKey) {
    fileKey = matchKey[1];
  }

  const matchNode = clean.match(/[?&](?:node-id|node_id)=([^&?#]+)/i);
  if (matchNode) {
    nodeId = decodeURIComponent(matchNode[1]).replace(/-/g, ":");
  }

  return { fileKey, nodeId };
}

export async function fetchSuggestedFrames(
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
