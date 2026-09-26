import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { VisualAnalysis } from "../types.js";
import { renderDesignNode, type RenderResult } from "../render.js";
import type {
  ZeplinAssetSpec,
  ZeplinExtractSpec,
  ZeplinScreenSpec,
} from "./types.js";

export async function renderZeplinScreen(
  screenId: string,
  authToken: string,
  outputDir: string,
  screen: ZeplinScreenSpec,
  extract: ZeplinExtractSpec,
  fetchFn: typeof fetch,
  imageUrl?: string
): Promise<{
  renderedImage?: string;
  rendering?: RenderResult;
  visualAnalysis?: VisualAnalysis;
}> {
  const rendering = await renderDesignNode(
    {
      provider: "zeplin",
      fileKeyOrScreenId: screenId,
      imageUrl,
      width: screen.width,
      height: screen.height,
      authToken,
      outputDir,
    },
    fetchFn
  );

  if (!rendering) return {};

  const width = screen.width || 0;
  const layoutType =
    width > 0 && width < 600
      ? "MOBILE_VIEW"
      : width >= 600
      ? "DESKTOP_VIEW"
      : "COMPONENT_CANVAS";
  const visibleLabels =
    (extract?.typography
      ?.map((t: any) => t.text)
      .filter(Boolean) as string[]) || [];
  const detectedComponents = screen.layerNames || [];

  return {
    renderedImage: rendering.savedPath,
    rendering,
    visualAnalysis: {
      screenshotPath: rendering.savedPath,
      detectedComponents,
      layoutType,
      visibleLabels,
    },
  };
}

export async function downloadZeplinAssets(
  screenId: string,
  outputDir: string | undefined,
  zHeaders: Record<string, string>,
  fetchFn: typeof fetch,
  versionAssets?: any[]
): Promise<{ assets: ZeplinAssetSpec[]; savedAssets: string[] }> {
  const savedAssets: string[] = [];
  let assets: ZeplinAssetSpec[] = [];

  try {
    const assetRes = versionAssets ? undefined : await fetchFn(
      `https://api.zeplin.dev/v1/screens/${screenId}/assets`,
      { headers: zHeaders }
    );
    const assetData = versionAssets || (assetRes?.ok ? await assetRes.json() : []);
    assets = (assetData || []).map((a: any) => {
      const content = a.contents?.find((c: any) => c.format === "svg") || a.contents?.[0];
      return {
        id: a.id || a.layer_source_id || a.display_name,
        name: a.name || a.display_name,
        format: content?.format || a.format || "svg",
        url: content?.url || a.url || a.file_url || "",
      };
    });

    if (outputDir && assets.length > 0) {
      if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
      for (const asset of assets) {
        if (!asset.url) continue;
        const fileName = `${asset.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.${asset.format.replace(/[^a-zA-Z0-9]/g, "") || "bin"}`;
        const filePath = path.join(outputDir, fileName);
        try {
          const imgRes = await fetchFn(asset.url);
          if (imgRes.ok) {
            writeFileSync(filePath, asset.format === "svg" ? await imgRes.text() : Buffer.from(await imgRes.arrayBuffer()));
            savedAssets.push(filePath);
          }
        } catch {}
      }
    }
  } catch {}

  return { assets, savedAssets };
}
