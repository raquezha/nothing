import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ComponentFact } from "../types.js";
import { scanComposableDeclarations } from "./composableScanner.js";

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", ".workflow", ".gradle", "build"]);

export function walk(rootPath: string): string[] {
  const out: string[] = [];
  function visit(current: string): void {
    if (!existsSync(current)) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else out.push(full);
    }
  }
  visit(rootPath);
  return out;
}

export function scanComponents(rootPath: string, files: string[]): ComponentFact[] {
  const componentMap = new Map<string, ComponentFact>();

  // 1. User-configured components in .nodesign.json
  const configPath = path.join(rootPath, ".nodesign.json");
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf8"));
      if (Array.isArray(cfg?.components)) {
        for (const comp of cfg.components) {
          if (comp.name) {
            componentMap.set(comp.name, {
              name: comp.name,
              count: 999,
              sampleUsage: comp.sampleUsage,
              path: comp.path || ".nodesign.json",
            });
          }
        }
      }
    } catch {}
  }

  // 2. Discover Kotlin @Composable declarations
  const composableFacts = scanComposableDeclarations(rootPath, files);
  for (const c of composableFacts) {
    if (!componentMap.has(c.name)) {
      componentMap.set(c.name, c);
    }
  }

  // 3. Discover XML layout files for Views projects (e.g. res/layout/activity_main.xml)
  for (const file of files) {
    if (file.endsWith(".xml") && file.includes(`${path.sep}layout`)) {
      const name = path.basename(file, ".xml");
      if (!componentMap.has(name)) {
        componentMap.set(name, {
          name,
          path: path.relative(rootPath, file),
          count: 1,
          sampleUsage: `@layout/${name}`,
        });
      }
    }
  }

  return Array.from(componentMap.values()).slice(0, 20);
}
