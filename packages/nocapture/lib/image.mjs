import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { withIsolatedScene } from "./render.mjs";

export async function renderImage({
  scene,
  output,
  width,
  height,
  scale = 2,
  selector = "#capture",
  allowOverflow = false,
  browserPath,
}) {
  const outputPath = path.resolve(output);
  if (path.extname(outputPath).toLowerCase() !== ".png") {
    throw new Error("--output must end in .png.");
  }

  return withIsolatedScene(
    { scene, width, height, deviceScaleFactor: scale, browserPath },
    async ({ page, failures }) => {
      await page.addStyleTag({
        content: "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }",
      });
      await page.evaluate(async () => {
        await document.fonts?.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });

      const geometry = await page.evaluate((targetSelector) => {
        const el = document.querySelector(targetSelector);
        if (!el) return { missing: true };
        return {
          missing: false,
          width: el.clientWidth,
          height: el.clientHeight,
          scrollWidth: el.scrollWidth,
          scrollHeight: el.scrollHeight,
          docWidth: document.documentElement.scrollWidth,
          docHeight: document.documentElement.scrollHeight,
          fontsStatus: document.fonts?.status ?? "loaded",
        };
      }, selector);

      if (geometry.missing) {
        throw new Error(`Capture target not found: ${selector}`);
      }
      if (!allowOverflow) {
        if (selector === "#capture" && (geometry.width !== width || geometry.height !== height)) {
          throw new Error(`Target ${selector} size ${geometry.width}x${geometry.height} does not match ${width}x${height}.`);
        }
        if (geometry.scrollWidth > geometry.width || geometry.scrollHeight > geometry.height) {
          throw new Error(`Target ${selector} overflows (${geometry.scrollWidth}x${geometry.scrollHeight} > ${geometry.width}x${geometry.height}).`);
        }
        if (geometry.docWidth > width || geometry.docHeight > height) {
          throw new Error(`Document overflows viewport (${geometry.docWidth}x${geometry.docHeight} > ${width}x${height}).`);
        }
      }
      if (geometry.fontsStatus !== "loaded") {
        throw new Error(`Fonts did not finish loading: ${geometry.fontsStatus}`);
      }
      if (failures.length) {
        throw new Error(failures.join("\n"));
      }

      const locator = page.locator(selector);
      const tempFirst = path.join(path.dirname(outputPath), `.${path.basename(outputPath)}.part1-${process.pid}.png`);
      const tempSecond = path.join(path.dirname(outputPath), `.${path.basename(outputPath)}.part2-${process.pid}.png`);
      try {
        await locator.screenshot({ path: tempFirst, type: "png", animations: "disabled", caret: "hide", scale: "device" });
        await locator.screenshot({ path: tempSecond, type: "png", animations: "disabled", caret: "hide", scale: "device" });

        const firstBytes = await fs.readFile(tempFirst);
        const secondBytes = await fs.readFile(tempSecond);
        const firstHash = createHash("sha256").update(firstBytes).digest("hex");
        const secondHash = createHash("sha256").update(secondBytes).digest("hex");
        if (firstHash !== secondHash) {
          throw new Error(`Non-deterministic capture: ${firstHash} != ${secondHash}`);
        }

        const pngWidth = firstBytes.readUInt32BE(16);
        const pngHeight = firstBytes.readUInt32BE(20);
        const expectedW = Math.round((selector === "#capture" ? width : geometry.width) * scale);
        const expectedH = Math.round((selector === "#capture" ? height : geometry.height) * scale);
        if (!allowOverflow && (pngWidth !== expectedW || pngHeight !== expectedH)) {
          throw new Error(`Unexpected PNG dimensions ${pngWidth}x${pngHeight}, expected ${expectedW}x${expectedH}.`);
        }

        await fs.rename(tempFirst, outputPath);
        return { output: outputPath, width: pngWidth, height: pngHeight, sha256: firstHash };
      } finally {
        await fs.rm(tempFirst, { force: true });
        await fs.rm(tempSecond, { force: true });
      }
    }
  );
}
