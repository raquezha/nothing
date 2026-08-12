import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { AndroidInspection, AndroidUIStack, ComponentFact } from "./types.js";

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", ".workflow"]);

function walk(rootPath: string): string[] {
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

function readText(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

export function detectAndroidUIStack(rootPath: string): AndroidUIStack {
  const files = walk(rootPath);
  const hasKmp = files.some((file) =>
    file.includes(`${path.sep}commonMain${path.sep}`) ||
    file.includes(`${path.sep}composeResources${path.sep}`),
  );
  if (hasKmp) return "kmp";

  const hasViews = files.some((file) =>
    file.includes(`${path.sep}res${path.sep}layout${path.sep}`) && file.endsWith(".xml"),
  );

  const gradleFiles = files.filter((file) =>
    file.endsWith(".gradle") ||
    file.endsWith(".gradle.kts") ||
    file.endsWith("libs.versions.toml"),
  );
  const hasCompose = gradleFiles.some((file) => {
    const text = readText(file);
    return (
      text.includes("androidx.compose") ||
      text.includes("org.jetbrains.compose") ||
      text.includes("compose = true") ||
      text.includes("compose true")
    );
  });

  if (hasCompose && hasViews) return "mixed";
  if (hasCompose) return "compose";
  if (hasViews) return "views";

  const hasAndroidSignals = files.some((file) =>
    file.endsWith("AndroidManifest.xml") ||
    file.endsWith("build.gradle") ||
    file.endsWith("build.gradle.kts"),
  );
  return hasAndroidSignals ? "ambiguous" : "n/a";
}

export function scanUiComponents(rootPath: string): ComponentFact[] {
  const files = walk(rootPath);
  return files
    .filter((file) => file.includes(`${path.sep}ui${path.sep}components${path.sep}`))
    .filter((file) => /\.(kt|kts|xml|tsx|ts|jsx|js)$/i.test(file))
    .map((file) => ({
      name: path.basename(file).replace(/\.[^.]+$/, ""),
      path: path.relative(rootPath, file),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function inspectAndroidProject(rootPath: string): AndroidInspection {
  const androidUIStack = detectAndroidUIStack(rootPath);
  const components = scanUiComponents(rootPath);
  const notes: string[] = [];

  if (androidUIStack === "n/a") notes.push("No Android or KMP UI signals detected");
  if (androidUIStack === "ambiguous") notes.push("Android project found, but Compose/XML/KMP signals are ambiguous");
  if (components.length === 0) notes.push("No reusable ui/components files detected");
  else notes.push(`Found ${components.length} reusable ui/components file(s)`);

  return { androidUIStack, components, notes };
}
