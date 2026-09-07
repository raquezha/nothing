import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AndroidInspection, AndroidUIStack, ArchitectureType, ComponentFact } from "./types.js";

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", ".workflow", ".gradle", "build"]);
const COMPONENT_EXTENSIONS = /\.(kt|kts|xml|tsx|ts|jsx|js)$/i;
const TEXT_EXTENSIONS = /\.(kt|kts|java|xml|properties|txt|md)$/i;

const NON_UI_SUFFIXES = /Dao$|Api$|Impl$|Entity$|Raw$|UseCase$|Repository$|Service$|State$|Effect$|Event$|Presenter$|Validator$|Database$|Params$|Strategy$|Mapper$|Helper$|Utils$|Config$|Module$|Factory$|Provider$|Converter$|Exception$|Error$|Result$|Response$|Request$|Preference$|Store$/i;

const UI_NAME_PATTERNS = /Button$|Dialog$|Screen$|Card$|Bar$|Item$|View$|Logo$|Header$|Footer$|TextField$|Image$|Icon$|Sheet$|Tab$|Row$|Column$|Container$|Toolbar$|Group$|Picker$|Slider$|Menu$|Badge$|Chip$|Avatar$|Fab$|Dropdown$|Switch$|CheckBox$|Radio$|Divider$|Banner$|Toast$/i;

const COMMON_STDLIB_SYMBOLS = new Set([
  "Column", "Row", "Box", "Text", "Spacer", "Surface", "Scaffold", "LazyColumn", "LazyRow", "LazyGrid",
  "Modifier", "Color", "String", "Boolean", "Int", "Float", "Double", "List", "Set", "Map", "Remember",
  "Composable", "DisposableEffect", "LaunchedEffect", "SideEffect", "State", "MutableState",
  "Button", "IconButton", "Icon", "Image", "Card", "Divider", "CircularProgressIndicator",
  "LinearProgressIndicator", "OutlinedTextField", "TextField", "Checkbox", "RadioButton", "Switch",
  "TopAppBar", "BottomAppBar", "NavigationRail", "ModalBottomSheet", "AlertDialog",
  "OptIn", "StateOf", "Font", "Resource", "Out", "CompositionLocalProvider", "LocalContext",
  "DerivedStateOf", "ProduceState", "SnapshotState", "RememberCoroutineScope", "RememberUpdatedState",
]);


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

  const configPath = path.join(rootPath, ".nodesign.json");
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf8"));
      if (Array.isArray(cfg?.colorTokens)) {
        for (const ct of cfg.colorTokens) {
          if (ct.hex && ct.token) {
            const hexKey = ct.hex.startsWith("#") ? ct.hex.toUpperCase() : `#${ct.hex.toUpperCase()}`;
            seen.add(hexKey);
            colorFacts.push({
              hex: hexKey,
              token: ct.token,
              sourceFile: ct.sourceFile || ".nodesign.json",
              importStatement: ct.importStatement,
            });
          }
        }
      }
    } catch {}
  }

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

      const objMatch = text.match(/object\s+([a-zA-Z0-9_]+Theme|[a-zA-Z0-9_]+Colors|[a-zA-Z0-9_]+DesignSystem)/);
      const themeObject = objMatch ? objMatch[1] : undefined;

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

export function scanUsagePatternFacts(rootPath: string): ComponentFact[] {
  const files = walk(rootPath);
  const usageMap = new Map<string, { name: string; count: number; sampleUsage?: string; sampleFile?: string }>();

  const configPath = path.join(rootPath, ".nodesign.json");
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf8"));
      if (Array.isArray(cfg?.components)) {
        for (const comp of cfg.components) {
          if (comp.name) {
            usageMap.set(comp.name, {
              name: comp.name,
              count: 999,
              sampleUsage: comp.sampleUsage,
              sampleFile: comp.path || ".nodesign.json",
            });
          }
        }
      }
    } catch {}
  }

  for (const file of files) {
    if (!COMPONENT_EXTENSIONS.test(file)) continue;
    const normPath = file.toLowerCase();

    // Skip non-UI files
    if (normPath.includes(`${path.sep}data${path.sep}`) ||
        normPath.includes(`${path.sep}domain${path.sep}`) ||
        normPath.includes(`${path.sep}network${path.sep}`) ||
        normPath.includes(`${path.sep}database${path.sep}`) ||
        normPath.includes(`${path.sep}di${path.sep}`)) {
      continue;
    }

    const text = readText(file);
    const relPath = path.relative(rootPath, file);

    // Only scan files that contain Composable functions or UI elements
    const isUiFile = text.includes("@Composable") ||
      normPath.includes(`${path.sep}ui${path.sep}`) ||
      normPath.includes(`${path.sep}components${path.sep}`) ||
      normPath.includes(`${path.sep}screens${path.sep}`) ||
      normPath.includes(`${path.sep}uikit${path.sep}`) ||
      normPath.includes(`${path.sep}sharedui${path.sep}`);

    if (!isUiFile) continue;

    const matches = text.matchAll(/([A-Z][a-zA-Z0-9_]{2,})\s*\(([^)]*)\)/g);
    for (const m of matches) {
      const compName = m[1];
      if (COMMON_STDLIB_SYMBOLS.has(compName)) continue;
      if (NON_UI_SUFFIXES.test(compName)) continue;

      const isKnownUiName = UI_NAME_PATTERNS.test(compName);
      if (!isKnownUiName && !isUiFile) continue;

      const rawArgs = m[2].trim().replace(/\s+/g, " ");
      const sampleArgs = rawArgs.length > 50 ? `${rawArgs.slice(0, 47)}...` : rawArgs;
      const sampleCall = `${compName}(${sampleArgs})`;

      const existing = usageMap.get(compName);
      if (existing) {
        existing.count++;
        if (!existing.sampleUsage && sampleArgs.length > 0) existing.sampleUsage = sampleCall;
      } else {
        usageMap.set(compName, {
          name: compName,
          count: 1,
          sampleUsage: sampleCall,
          sampleFile: relPath,
        });
      }
    }
  }

  const out: ComponentFact[] = [];
  for (const [name, info] of usageMap.entries()) {
    if (info.count >= 1) {
      out.push({
        name,
        path: info.sampleFile ? `${info.sampleFile} (used ${info.count}x in codebase)` : `Discovered from usage (${info.count}x)`,
        count: info.count,
        sampleUsage: info.sampleUsage,
      });
    }
  }

  return out.sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 15);
}

function detectArchitectureType(files: string[]): { type: ArchitectureType; details: string } {
  const normFiles = files.map((f) => f.toLowerCase());

  const hasDomain = normFiles.some((f) => f.includes(`${path.sep}domain${path.sep}`) || f.includes(":domain"));
  const hasData = normFiles.some((f) => f.includes(`${path.sep}data${path.sep}`) || f.includes(":data"));
  const hasPresentation = normFiles.some((f) => f.includes(`${path.sep}presentation${path.sep}`) || f.includes(":presentation"));

  const useCaseFiles = normFiles.filter((f) => /usecase|interactor/i.test(path.basename(f)));
  const repositoryFiles = normFiles.filter((f) => /repository|gateway|port|adapter/i.test(path.basename(f)));
  const viewModelFiles = normFiles.filter((f) => /viewmodel|state|intent/i.test(path.basename(f)));

  const hasCleanCodePatterns = (useCaseFiles.length > 0 || repositoryFiles.length > 0) &&
    (hasPresentation || viewModelFiles.length > 0);

  if ((hasDomain && (hasData || hasPresentation)) || hasCleanCodePatterns || (useCaseFiles.length > 0 && repositoryFiles.length > 0)) {
    const details = useCaseFiles.length || repositoryFiles.length
      ? `Verified Clean Architecture via ${useCaseFiles.length} UseCase(s) and ${repositoryFiles.length} Repository/Gateway declaration(s)`
      : `Verified Clean Architecture via domain/data/presentation packages`;
    return { type: "CLEAN_ARCHITECTURE", details };
  }

  const hasDesignSystemModule = normFiles.some((f) =>
    f.includes(`${path.sep}designsystem${path.sep}`) ||
    f.includes(":designsystem") ||
    f.includes(`${path.sep}core${path.sep}ui${path.sep}`) ||
    /theme|designsystem/i.test(path.basename(f))
  );
  if (hasDesignSystemModule) {
    return { type: "DESIGN_SYSTEM_MODULE", details: "Verified Design System module (designsystem/core:ui/theme)" };
  }

  const hasFeatureByPackage = normFiles.some((f) =>
    f.includes(`${path.sep}feature${path.sep}`) ||
    f.includes(`${path.sep}features${path.sep}`) ||
    f.includes(":feature:")
  );
  if (hasFeatureByPackage) {
    return { type: "FEATURE_BY_PACKAGE", details: "Verified Feature-by-package structure (feature/*/)" };
  }

  const hasLayerByPackage = normFiles.some((f) =>
    f.includes(`${path.sep}screens${path.sep}`) ||
    f.includes(`${path.sep}viewmodels${path.sep}`) ||
    f.includes(`${path.sep}ui${path.sep}components${path.sep}`)
  );
  if (hasLayerByPackage) {
    return { type: "LAYER_BY_PACKAGE", details: "Verified Layer-by-package structure (screens/viewmodels/components)" };
  }

  return { type: "AD_HOC", details: "Ad-hoc / single-folder structure" };
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

  const fileComponents = files
    .filter((file) =>
      file.includes(`${path.sep}ui${path.sep}components${path.sep}`) ||
      file.includes(`${path.sep}components${path.sep}`) ||
      file.includes(`${path.sep}uikit${path.sep}`) ||
      file.includes(`${path.sep}sharedui${path.sep}`),
    )
    .filter((file) => COMPONENT_EXTENSIONS.test(file))
    .map((file) => ({
      name: path.basename(file).replace(/\.[^.]+$/, ""),
      path: path.relative(rootPath, file),
    }));

  const usageComponents = scanUsagePatternFacts(rootPath);
  const componentMap = new Map<string, ComponentFact>();

  for (const fc of fileComponents) {
    if (!NON_UI_SUFFIXES.test(fc.name)) {
      componentMap.set(fc.name, fc);
    }
  }

  for (const uc of usageComponents) {
    if (!componentMap.has(uc.name)) {
      componentMap.set(uc.name, uc);
    } else {
      const existing = componentMap.get(uc.name)!;
      componentMap.set(uc.name, {
        ...existing,
        count: uc.count,
        sampleUsage: uc.sampleUsage,
        path: `${existing.path} (used ${uc.count}x in codebase)`,
      });
    }
  }

  const components = Array.from(componentMap.values())
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 15);

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

export function detectAndroidUIStack(rootPath: string): AndroidUIStack {
  return inspectFiles(rootPath).androidUIStack;
}

export function scanUiComponents(rootPath: string): ComponentFact[] {
  return inspectFiles(rootPath).components;
}

export function inspectAndroidProject(rootPath: string): AndroidInspection {
  return inspectFiles(rootPath);
}
