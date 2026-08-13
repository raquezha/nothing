import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AndroidInspection, AndroidUIStack, ComponentFact } from "./types.js";

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", ".workflow", ".gradle", "build"]);
const COMPONENT_EXTENSIONS = /\.(kt|kts|xml|tsx|ts|jsx|js)$/i;
const TEXT_EXTENSIONS = /\.(kt|kts|java|xml|properties|txt|md)$/i;

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

function inspectFiles(rootPath: string): AndroidInspection {
  const files = walk(rootPath);
  const gradleFiles = files.filter((file) =>
    file.endsWith(".gradle") ||
    file.endsWith(".gradle.kts") ||
    file.endsWith("libs.versions.toml"),
  );
  const gradleTexts = gradleFiles.map(readText);

  const hasCommonMain = files.some((file) => file.includes(`${path.sep}commonMain${path.sep}`));
  const hasComposeResources = files.some((file) => file.includes(`${path.sep}composeResources${path.sep}`));
  const hasKmpComposeUsage = files.some((file) => {
    if (!file.includes(`${path.sep}commonMain${path.sep}`)) return false;
    if (!TEXT_EXTENSIONS.test(file)) return false;
    const text = readText(file);
    return text.includes("@Composable") || text.includes("androidx.compose") || text.includes("org.jetbrains.compose");
  });
  const hasKmpComposeGradle = gradleTexts.some((text) => text.includes("org.jetbrains.compose"));

  const hasViews = files.some((file) =>
    file.includes(`${path.sep}res${path.sep}`) &&
    /(?:^|[\\/])layout(?:-[^\\/]+)?[\\/][^\\/]+\.xml$/i.test(file),
  );

  const hasCompose = gradleTexts.some((text) =>
    text.includes("androidx.compose") ||
    text.includes("compose = true") ||
    text.includes("compose true"),
  );

  const hasAndroidManifest = files.some((file) => file.endsWith("AndroidManifest.xml"));
  const hasAndroidGradlePlugin = gradleTexts.some((text) =>
    text.includes("com.android.application") ||
    text.includes("com.android.library") ||
    text.includes("com.android.kotlin.multiplatform.library") ||
    text.includes("libs.plugins.android.") ||
    text.includes("libs.plugins.kotlin.android"),
  );

  const components = files
    .filter((file) => file.includes(`${path.sep}ui${path.sep}components${path.sep}`))
    .filter((file) => COMPONENT_EXTENSIONS.test(file))
    .map((file) => ({
      name: path.basename(file).replace(/\.[^.]+$/, ""),
      path: path.relative(rootPath, file),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  let androidUIStack: AndroidUIStack = "n/a";
  if (hasComposeResources || (hasCommonMain && (hasKmpComposeUsage || hasKmpComposeGradle))) androidUIStack = "kmp";
  else if (hasCompose && hasViews) androidUIStack = "mixed";
  else if (hasCompose) androidUIStack = "compose";
  else if (hasViews) androidUIStack = "views";
  else if (hasAndroidManifest || hasAndroidGradlePlugin) androidUIStack = "ambiguous";

  const notes: string[] = [];
  if (androidUIStack === "n/a") notes.push(`No Android or KMP UI signals detected in ${rootPath}`);
  if (androidUIStack === "ambiguous") notes.push(`Android project found in ${rootPath}, but Compose/XML/KMP signals are ambiguous`);
  if (components.length === 0) notes.push(`No reusable ui/components files detected in ${rootPath}`);
  else notes.push(`Found ${components.length} reusable ui/components file(s) in ${rootPath}`);

  return { androidUIStack, components, notes };
}

export function detectAndroidUIStack(rootPath: string): AndroidUIStack {
  return inspectFiles(rootPath).androidUIStack;
}

export function scanUiComponents(rootPath: string): ComponentFact[] {
  return inspectFiles(rootPath).components;
}

export function inspectAndroidProject(rootPath: string): AndroidInspection {
  return inspectFiles(rootPath);
}
