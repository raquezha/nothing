import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AndroidInspection, AndroidUIStack, ComponentFact } from "./types.js";

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", ".workflow", ".gradle", "build"]);
const COMPONENT_EXTENSIONS = /\.(kt|kts|xml|tsx|ts|jsx|js)$/i;
const TEXT_EXTENSIONS = /\.(kt|kts|java|xml|properties|txt|md)$/i;

export interface ColorTokenFact {
  hex: string;
  token: string;
  sourceFile: string;
  packageName?: string;
  importStatement?: string;
}

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

export function scanColorTokens(rootPath: string): ColorTokenFact[] {
  const files = walk(rootPath);
  const colorFacts: ColorTokenFact[] = [];
  const seen = new Set<string>();

  function addFact(hexRaw: string, token: string, file: string, pkg?: string) {
    let cleanHex = hexRaw.toUpperCase().trim();
    if (cleanHex.length === 4 && cleanHex.startsWith("#")) {
      cleanHex = `#${cleanHex[1]}${cleanHex[1]}${cleanHex[2]}${cleanHex[2]}${cleanHex[3]}${cleanHex[3]}`;
    }
    const hexKey = cleanHex.startsWith("#") ? cleanHex : `#${cleanHex}`;
    if (!seen.has(hexKey)) {
      seen.add(hexKey);
      const relFile = path.relative(rootPath, file);
      const importStatement = pkg && !token.startsWith("colorResource")
        ? `import ${pkg}.${token.split(".")[0]}`
        : undefined;

      colorFacts.push({
        hex: hexKey,
        token,
        sourceFile: relFile,
        packageName: pkg,
        importStatement,
      });
    }
  }

  for (const file of files) {
    // 1. Scan colors.xml
    if (file.endsWith("colors.xml") || file.endsWith("values/colors.xml")) {
      const text = readText(file);
      const matches = text.matchAll(/<color\s+name=["']([^"']+)["']\s*>([^<]+)<\/color>/gi);
      for (const m of matches) {
        const name = m[1];
        const rawVal = m[2].trim().toUpperCase();
        if (/^#([0-9A-F]{3}|[0-9A-F]{6}|[0-9A-F]{8})$/i.test(rawVal)) {
          addFact(rawVal, `colorResource(R.color.${name})`, file);
        }
      }
    }

    // 2. Deep-scan all Kotlin files under theme / ui / designsystem / commonMain or ending in *Theme.kt, *Color.kt
    const isThemeFile = file.endsWith(".kt") && (
      file.includes(`${path.sep}theme${path.sep}`) ||
      file.includes(`${path.sep}ui${path.sep}`) ||
      file.includes(`${path.sep}designsystem${path.sep}`) ||
      file.includes(`${path.sep}commonMain${path.sep}`) ||
      /Theme|Color|Design/i.test(path.basename(file))
    );

    if (isThemeFile) {
      const text = readText(file);
      const pkgMatch = text.match(/^package\s+([a-zA-Z0-9_.]+)/m);
      const packageName = pkgMatch ? pkgMatch[1] : undefined;

      // Check for theme object wrapper (e.g. object TapatTheme or object TapatColors)
      const objMatch = text.match(/object\s+([a-zA-Z0-9_]+Theme|[a-zA-Z0-9_]+Colors|[a-zA-Z0-9_]+DesignSystem)/);
      const themeObject = objMatch ? objMatch[1] : undefined;

      // Matches val PrimaryBlue = Color(0xFF2878F0) or val primary: Color = Color(0x2878F0)
      const matches = text.matchAll(/val\s+([a-zA-Z0-9_]+)(?:\s*:\s*Color)?\s*=\s*Color\(\s*0x([0-9a-fA-F]+)\s*\)/g);
      for (const m of matches) {
        const propName = m[1];
        let hexVal = m[2].toUpperCase();
        if (hexVal.length === 8 && hexVal.startsWith("FF")) hexVal = hexVal.slice(2);
        const hex = `#${hexVal}`;
        const token = themeObject ? `${themeObject}.${propName}` : propName;
        addFact(hex, token, file, packageName);
      }
    }
  }

  return colorFacts;
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
    .filter((file) =>
      file.includes(`${path.sep}ui${path.sep}components${path.sep}`) ||
      file.includes(`${path.sep}components${path.sep}`) ||
      file.includes(`${path.sep}ui${path.sep}`),
    )
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
