import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "templates");

export const TEMPLATE_METADATA = {
  comparison: {
    name: "comparison",
    description: "Side by side or stacked diff with badge pills and vector goodies",
    width: 1200,
    height: 675,
    filename: "comparison.html",
  },
  mobile: {
    name: "mobile",
    description: "Mobile smartphone mockup with dynamic island, status bar, and feed cards",
    width: 1200,
    height: 800,
    filename: "mobile.html",
  },
  terminal: {
    name: "terminal",
    description: "Window chrome, dark background, typed command prompts, and status output",
    width: 1200,
    height: 675,
    filename: "terminal.html",
  },
  tutorial: {
    name: "tutorial",
    description: "Step by step explainer with camera zoom, callout badges, and code stage",
    width: 1200,
    height: 675,
    filename: "tutorial.html",
  },
};

export const AVAILABLE_TEMPLATES = Object.keys(TEMPLATE_METADATA);

export function listTemplates() {
  return Object.values(TEMPLATE_METADATA);
}

export function getTemplatePath(name) {
  const meta = TEMPLATE_METADATA[name];
  if (!meta) {
    throw new Error(`Unknown template "${name}". Available templates: ${AVAILABLE_TEMPLATES.join(", ")}`);
  }
  return path.join(TEMPLATES_DIR, meta.filename);
}

export async function scaffoldTemplate({ template, output, force = false }) {
  if (!template) {
    throw new Error(`Missing template name. Available templates: ${AVAILABLE_TEMPLATES.join(", ")}`);
  }
  const meta = TEMPLATE_METADATA[template];
  if (!meta) {
    throw new Error(`Unknown template "${template}". Available templates: ${AVAILABLE_TEMPLATES.join(", ")}`);
  }

  const srcPath = path.join(TEMPLATES_DIR, meta.filename);
  const destPath = path.resolve(output || `${template}.html`);

  const destExists = await fs.stat(destPath).then(() => true).catch(() => false);
  if (destExists && !force) {
    throw new Error(`Destination file already exists: ${destPath}. Use --force to overwrite.`);
  }

  const content = await fs.readFile(srcPath, "utf8");
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, content, "utf8");

  return {
    template,
    output: destPath,
    width: meta.width,
    height: meta.height,
  };
}
