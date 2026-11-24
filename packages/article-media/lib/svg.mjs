import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderImage } from "./image.mjs";

const MANAGED_FONTS = new Set(["Caveat", "Inter"]);

function parseSvgHeader(svg) {
  const openTag = svg.match(/<svg\b([^>]*)>/i)?.[1] ?? "";
  const viewBox = openTag.match(/\bviewBox=["']([^"']+)["']/i)?.[1] ?? null;
  const width = openTag.match(/\bwidth=["']([^"']+)["']/i)?.[1] ?? null;
  const height = openTag.match(/\bheight=["']([^"']+)["']/i)?.[1] ?? null;
  return { viewBox, width: width ? Number.parseFloat(width) : null, height: height ? Number.parseFloat(height) : null };
}

function parseEmbeddedFaces(svg) {
  const faces = new Map();
  for (const match of svg.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
    const block = match[1];
    const familyRaw = block.match(/font-family:\s*['"]?([^'";]+)['"]?/i)?.[1]?.trim();
    const weight = block.match(/font-weight:\s*([^;]+)/i)?.[1]?.trim() ?? "400";
    const hasWoff2 = /data:font\/woff2;base64,/i.test(block);
    if (familyRaw && hasWoff2) {
      if (!faces.has(familyRaw)) faces.set(familyRaw, new Set());
      faces.get(familyRaw).add(weight);
    }
  }
  return faces;
}

function checkExternalUrls(svg) {
  const urls = [];
  for (const match of svg.matchAll(/\b(?:href|xlink:href|src)=["'](https?:\/\/[^"']+)["']/gi)) {
    urls.push(match[1]);
  }
  for (const match of svg.matchAll(/url\(\s*['"]?(https?:\/\/[^'")]+)['"]?\s*\)/gi)) {
    urls.push(match[1]);
  }
  for (const match of svg.matchAll(/@import\s+(?:url\(\s*)?['"]?(https?:\/\/[^'")\s;]+)/gi)) {
    urls.push(match[1]);
  }
  return urls;
}

function primaryFontFromAttr(value) {
  if (!value) return null;
  return value.split(",")[0].replace(/['"]/g, "").trim();
}

function extractStyleProp(styleAttr, prop) {
  if (!styleAttr) return null;
  const m = styleAttr.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"));
  return m ? m[1].trim() : null;
}

export async function checkSvg(inputPath) {
  const resolved = path.resolve(inputPath);
  const svg = await fs.readFile(resolved, "utf8");
  const header = parseSvgHeader(svg);
  const errors = [];

  if (!header.viewBox) errors.push("SVG must declare an explicit viewBox.");
  if (!Number.isFinite(header.width) || !Number.isFinite(header.height)) {
    errors.push("SVG must declare numeric width and height attributes.");
  }

  const external = checkExternalUrls(svg);
  if (external.length) {
    errors.push(`External URLs are not allowed in SVG: ${external.join(", ")}`);
  }

  const embedded = parseEmbeddedFaces(svg);
  const defaultFamilyMatch = svg.match(/<g\b[^>]*\bfont-family=["']([^"']+)["']/i);
  const defaultFamily = primaryFontFromAttr(defaultFamilyMatch?.[1]);

  for (const match of svg.matchAll(/<(text|tspan)\b([^>]*)>/gi)) {
    const attrs = match[2];
    const styleAttr = attrs.match(/\bstyle=["']([^"']+)["']/i)?.[1];
    const famAttr = attrs.match(/\bfont-family=["']([^"']+)["']/i)?.[1] ?? extractStyleProp(styleAttr, "font-family");
    const fam = primaryFontFromAttr(famAttr) ?? defaultFamily;
    const weight = (attrs.match(/\bfont-weight=["']([^"']+)["']/i)?.[1] ?? extractStyleProp(styleAttr, "font-weight") ?? "400").trim();
    if (fam && MANAGED_FONTS.has(fam)) {
      const weights = embedded.get(fam);
      if (!weights || !weights.has(weight)) {
        errors.push(`Missing embedded base64 WOFF2 @font-face for ${fam} weight ${weight}.`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`${resolved}:\n- ${errors.join("\n- ")}`);
  }

  return {
    file: resolved,
    viewBox: header.viewBox,
    width: header.width,
    height: header.height,
    embeddedFonts: Object.fromEntries([...embedded.entries()].map(([k, v]) => [k, [...v]])),
  };
}

export async function previewSvg({ input, output, scale = 2, browserPath }) {
  const info = await checkSvg(input);
  const width = Math.ceil(info.width);
  const height = Math.ceil(info.height);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "article-media-svg-"));
  const scene = path.join(tempDir, "scene.html");
  const localSvg = path.join(tempDir, path.basename(info.file));
  try {
    await fs.copyFile(info.file, localSvg);
    await fs.writeFile(
      scene,
      `<!doctype html><html><body style="margin:0;background:transparent;"><div id="capture" style="width:${width}px;height:${height}px;overflow:hidden;"><img src="./${path.basename(localSvg)}" width="${width}" height="${height}" style="display:block;" /></div></body></html>`
    );
    return await renderImage({ scene, output, width, height, scale, selector: "#capture", browserPath });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
