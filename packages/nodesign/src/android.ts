import { readFileSync } from "node:fs";
import path from "node:path";
import type { AndroidInspection, AndroidUIStack, ComponentFact } from "./types.js";
import { scanColorTokens, type ColorTokenFact } from "./scanner/tokens.js";
import { detectArchitectureType } from "./scanner/architecture.js";
import { walk, scanComponents } from "./scanner/components.js";

export { scanColorTokens, type ColorTokenFact };
export { detectArchitectureType };

const TEXT_EXTENSIONS = /\.(kt|kts|java|xml|properties|txt|md)$/i;

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

  const components = scanComponents(rootPath, files);

  let androidUIStack: AndroidUIStack = "n/a";
  if (hasComposeResources || (hasCommonMain && (hasKmpComposeUsage || hasKmpComposeGradle))) androidUIStack = "kmp";
  else if (hasCompose && hasViews) androidUIStack = "mixed";
  else if (hasCompose) androidUIStack = "compose";
  else if (hasViews) androidUIStack = "views";
  else if (hasAndroidManifest || hasAndroidGradlePlugin) androidUIStack = "ambiguous";

  const archInfo = detectArchitectureType(files);
  const architectureType = archInfo.type;

  const notes: string[] = [];
  notes.push(`Project Architecture Structure: ${architectureType} (${archInfo.details})`);
  if (androidUIStack === "n/a") notes.push(`No Android or KMP UI signals detected in ${rootPath}`);
  if (androidUIStack === "ambiguous") notes.push(`Android project found in ${rootPath}, but Compose/XML/KMP signals are ambiguous`);
  if (components.length === 0) notes.push(`No reusable ui/components files detected in ${rootPath}`);
  else notes.push(`Found ${components.length} reusable UI component(s) in ${rootPath}`);

  return { androidUIStack, architectureType, components, notes };
}

export function inspectAndroidProject(rootPath: string): AndroidInspection {
  return inspectFiles(rootPath);
}

export function detectAndroidUIStack(rootPath: string): AndroidUIStack {
  return inspectFiles(rootPath).androidUIStack;
}

export function scanUiComponents(rootPath: string): ComponentFact[] {
  return inspectFiles(rootPath).components;
}
