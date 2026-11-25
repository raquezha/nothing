import fs from "node:fs/promises";
import path from "node:path";
import { renderImage } from "./image.mjs";
import { checkSvg, previewSvg } from "./svg.mjs";

export async function runBatch(manifestPath, { renderVideoJob, browserPath }) {
  const resolved = path.resolve(manifestPath);
  const baseDir = path.dirname(resolved);
  const items = JSON.parse(await fs.readFile(resolved, "utf8"));
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Batch manifest must be a non-empty JSON array.");
  }

  const results = [];
  for (const item of items) {
    if (item.kind === "image") {
      results.push({
        kind: "image",
        ...(await renderImage({
          scene: path.resolve(baseDir, item.scene),
          output: path.resolve(baseDir, item.output),
          width: item.width,
          height: item.height,
          scale: item.scale ?? 2,
          selector: item.selector ?? "#capture",
          allowOverflow: Boolean(item.allowOverflow),
          browserPath,
        })),
      });
    } else if (item.kind === "svg") {
      const checked = await checkSvg(path.resolve(baseDir, item.input));
      if (item.preview) {
        const preview = await previewSvg({
          input: checked.file,
          output: path.resolve(baseDir, item.preview),
          scale: item.scale ?? 2,
          browserPath,
        });
        results.push({ kind: "svg", ...checked, preview });
      } else {
        results.push({ kind: "svg", ...checked });
      }
    } else if (item.kind === "video") {
      await renderVideoJob({
        scene: path.resolve(baseDir, item.scene),
        output: path.resolve(baseDir, item.output),
        duration: item.duration,
        fps: item.fps,
        width: item.width,
        height: item.height,
        audio: item.audio ? path.resolve(baseDir, item.audio) : undefined,
        preview: Boolean(item.preview),
        browserPath,
      });
      results.push({ kind: "video", output: path.resolve(baseDir, item.output) });
    } else {
      throw new Error(`Unknown manifest item kind: ${item.kind}`);
    }
  }
  return results;
}
