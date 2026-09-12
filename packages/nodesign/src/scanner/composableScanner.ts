import { readFileSync } from "node:fs";
import path from "node:path";
import type { ComponentFact } from "../types.js";

function readText(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

export function scanComposableDeclarations(rootPath: string, files: string[]): ComponentFact[] {
  const componentMap = new Map<string, ComponentFact>();

  // 1. Kotlin Composable functions: @Composable fun ComponentName(...)
  const composableRegex = /@Composable\s+(?:(?:public|internal|private)\s+)?fun\s+([A-Z][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g;

  for (const file of files) {
    if (!file.endsWith(".kt")) continue;
    const relPath = path.relative(rootPath, file);
    const norm = relPath.toLowerCase();

    // Skip build outputs and tests
    if (norm.includes(`${path.sep}build${path.sep}`) ||
        norm.includes(`${path.sep}test${path.sep}`) ||
        norm.includes(`${path.sep}androidtest${path.sep}`)) {
      continue;
    }

    const text = readText(file);
    if (!text.includes("@Composable")) continue;

    // Check Figma Code Connect declarations
    if (file.endsWith(".figma.kt")) {
      for (const m of text.matchAll(/figma\.connect\(\s*([a-zA-Z0-9_]+)/g)) {
        const name = m[1];
        componentMap.set(name, {
          name,
          path: relPath,
          count: 999,
          confidence: "HIGH",
          sampleUsage: `${name}()`,
        });
      }
    }

    // Inspect real @Composable function declarations
    for (const match of text.matchAll(composableRegex)) {
      const name = match[1];
      const rawParams = match[2].trim().replace(/\s+/g, " ");
      const sampleArgs = rawParams.length > 50 ? `${rawParams.slice(0, 47)}...` : rawParams;
      const sampleUsage = `${name}(${sampleArgs})`;

      // Skip preview composables (e.g. @Preview fun ComponentPreview())
      if (name.endsWith("Preview")) continue;

      if (!componentMap.has(name)) {
        componentMap.set(name, {
          name,
          path: relPath,
          count: 1,
          confidence: "HIGH",
          sampleUsage,
        });
      }
    }

    // Inspect invocations of PascalCase UI components in Composable files (e.g. AppToolbar(title = "Home"))
    const invocationMatches = text.matchAll(/([A-Z][a-zA-Z0-9_]{2,})\s*\(([^)]*)\)/g);
    for (const m of invocationMatches) {
      const name = m[1];
      if (name.endsWith("Preview")) continue;
      // Skip common Kotlin / Compose built-ins
      if (["Column", "Row", "Box", "Text", "Spacer", "Modifier", "Color", "String", "Boolean", "Int", "Composable"].includes(name)) continue;

      const rawArgs = m[2].trim().replace(/\s+/g, " ");
      const sampleArgs = rawArgs.length > 50 ? `${rawArgs.slice(0, 47)}...` : rawArgs;
      const sampleUsage = `${name}(${sampleArgs})`;

      if (componentMap.has(name)) {
        const existing = componentMap.get(name)!;
        existing.count = (existing.count || 1) + 1;
      } else {
        componentMap.set(name, {
          name,
          path: `${relPath} (used in codebase)`,
          count: 1,
          confidence: "MEDIUM",
          sampleUsage,
        });
      }
    }
  }

  return Array.from(componentMap.values());
}
