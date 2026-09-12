import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DesignLink } from "../types.js";
import { resolveZeplinScreen } from "../zeplin.js";
import { resolveFigmaLink } from "../figma.js";

export function findWorkflowTaskPath(startDir: string): string | undefined {
  let current = path.resolve(startDir);
  while (true) {
    const activePath = path.join(current, ".workflow", "active.json");
    if (existsSync(activePath)) {
      try {
        const active = JSON.parse(readFileSync(activePath, "utf8"));
        if (active?.taskPath) return path.resolve(current, active.taskPath);
      } catch {
        return undefined;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export async function resolveZeplinLinks(designLinks: DesignLink[], fetchFn: typeof fetch, outputDir?: string) {
  const results = [];
  for (const link of designLinks) {
    if (link.provider !== "zeplin") continue;
    results.push(await resolveZeplinScreen(link.url, undefined, outputDir, fetchFn));
  }
  return results;
}

export async function resolveFigmaLinks(designLinks: DesignLink[], fetchFn: typeof fetch, outputDir?: string) {
  const results = [];
  for (const link of designLinks) {
    if (link.provider !== "figma") continue;
    results.push(await resolveFigmaLink(link.url, undefined, outputDir, fetchFn));
  }
  return results;
}
