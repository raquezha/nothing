import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface RenderOptions {
  provider: "figma" | "zeplin";
  fileKeyOrScreenId: string;
  nodeId?: string;
  authToken: string;
  outputDir: string;
  format?: "png" | "svg" | "jpg";
  scale?: number;
}

export interface RenderResult {
  savedPath: string;
  imageUrl: string;
  width?: number;
  height?: number;
  format: "png" | "svg" | "jpg";
}

export async function renderDesignNode(
  options: RenderOptions,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<RenderResult | undefined> {
  const { provider, fileKeyOrScreenId, nodeId, authToken, outputDir } = options;
  const format = options.format || "png";
  const scale = options.scale || 2;

  if (provider === "figma") {
    if (!fileKeyOrScreenId) return undefined;
    const targetId = nodeId || "0:1";
    const queryId = encodeURIComponent(targetId);
    const apiUrl = `https://api.figma.com/v1/images/${fileKeyOrScreenId}?ids=${queryId}&scale=${scale}&format=${format}`;

    try {
      const res = await fetchFn(apiUrl, {
        headers: { "X-Figma-Token": authToken },
      });
      if (!res.ok) return undefined;
      const data = (await res.json()) as any;
      const imageUrl = data?.images?.[targetId]
        || data?.images?.[targetId.replace(":", "-")]
        || (data?.images ? (Object.values(data.images)[0] as string) : undefined);

      if (!imageUrl) return undefined;
      const imgRes = await fetchFn(imageUrl);
      if (!imgRes.ok) return undefined;

      if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
      const safeId = targetId.replace(/[^a-zA-Z0-9_-]/g, "-");
      const fileName = `figma-${fileKeyOrScreenId}_${safeId}.${format}`;
      const filePath = path.join(outputDir, fileName);

      if (format === "svg") {
        const content = await imgRes.text();
        writeFileSync(filePath, content, "utf8");
      } else {
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        writeFileSync(filePath, buffer);
      }

      return {
        savedPath: filePath,
        imageUrl,
        format,
      };
    } catch {
      return undefined;
    }
  }

  if (provider === "zeplin") {
    try {
      const res = await fetchFn(`https://api.zeplin.dev/v1/screens/${fileKeyOrScreenId}`, {
        headers: { "Zeplin-Access-Token": authToken },
      });
      if (!res.ok) return undefined;
      const data = (await res.json()) as any;
      const imageUrl = data.image?.original_url || data.image?.png_url || data.image?.url || data.image_url || data.snapshot_url;
      if (!imageUrl) return undefined;

      let imgRes = await fetchFn(imageUrl);
      if (!imgRes.ok) {
        imgRes = await fetchFn(imageUrl, { headers: { "Zeplin-Access-Token": authToken } });
      }
      if (!imgRes.ok) return undefined;

      if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
      const fileName = `zeplin-${fileKeyOrScreenId}.${format}`;
      const filePath = path.join(outputDir, fileName);

      const buffer = Buffer.from(await imgRes.arrayBuffer());
      writeFileSync(filePath, buffer);

      return {
        savedPath: filePath,
        imageUrl,
        width: data.width,
        height: data.height,
        format,
      };
    } catch {
      return undefined;
    }
  }

  return undefined;
}
