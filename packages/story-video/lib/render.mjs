import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function chromePath() {
  const candidate = process.env.STORY_VIDEO_CHROME || defaultChrome;
  if (!fs.existsSync(candidate)) {
    throw new Error(`Chrome was not found at ${candidate}. Set STORY_VIDEO_CHROME to an installed Chrome executable.`);
  }
  return candidate;
}

function localAssets(pageUrl) {
  return Array.from(document.querySelectorAll("img[src], video[src], audio[src], source[src], script[src], link[href]"), (element) => {
    const attribute = element.tagName === "LINK" ? "href" : "src";
    return new URL(element.getAttribute(attribute), pageUrl).href;
  });
}

export async function captureTimes({ scene, width, height }, times, onCapture) {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    throw new Error("playwright-core is required to render story videos.");
  }

  const scenePath = path.resolve(scene);
  if (!fs.statSync(scenePath, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Scene was not found: ${scenePath}`);
  }

  const failures = [];
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on("pageerror", (error) => failures.push(`Page error: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(`Console error: ${message.text()}`);
    });
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("file:") || url.startsWith("data:") || url.startsWith("about:")) return route.continue();
      failures.push(`Network asset is not allowed: ${url}`);
      return route.abort();
    });
    await page.goto(pathToFileURL(scenePath).href, { waitUntil: "load" });
    await page.evaluate(async () => document.fonts?.ready);
    for (const asset of await page.evaluate(localAssets, page.url())) {
      if (!asset.startsWith("file:") || !fs.existsSync(fileURLToPath(asset))) {
        failures.push(`Missing or non-local asset: ${asset}`);
      }
    }
    if (failures.length) throw new Error(failures.join("\n"));
    if (!await page.evaluate(() => typeof window.renderAt === "function")) {
      throw new Error("Scene must define window.renderAt(seconds).");
    }

    const cdp = await context.newCDPSession(page);
    const captured = new Map();
    for (let index = 0; index < times.length; index++) {
      const seconds = times[index];
      await page.evaluate(async (time) => window.renderAt(time), seconds);
      if (failures.length) throw new Error(failures.join("\n"));
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
      const png = Buffer.from(data, "base64");
      if (onCapture) await onCapture(png, index, seconds);
      else captured.set(seconds, png);
    }
    return captured;
  } finally {
    await browser.close();
  }
}
