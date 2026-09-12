import type { ArchitectureType, ComponentFact, AndroidUIStack } from "./types.js";
import type { ColorTokenFact } from "./android.js";
import type { FigmaNodeSpec, FigmaColorSpec } from "./figma.js";
import type { ZeplinNodeSpec, ZeplinColorSpec } from "./zeplin.js";
import { formatTreeBlueprint } from "./brief.js";

import { matchComponent } from "./matcher.js";

type UnifiedNode = FigmaNodeSpec | ZeplinNodeSpec;
type UnifiedColorSpec = FigmaColorSpec | ZeplinColorSpec | string;

export interface ProjectGroundingContext {
  components?: ComponentFact[];
  colorTokens?: ColorTokenFact[];
  architectureType?: ArchitectureType;
  androidUIStack?: AndroidUIStack;
}

export interface MatchedDesignToken {
  hex: string;
  token: string;
  sourceFile: string;
  importStatement?: string;
}

export interface MatchedComponentMapping {
  designNodeName: string;
  localComponentName: string;
  path: string;
  confidence: string;
  sampleUsage?: string;
}

export interface GroundingManifest {
  screenName: string;
  uiStack?: AndroidUIStack;
  matchedTokens: MatchedDesignToken[];
  matchedComponents: MatchedComponentMapping[];
  reusableComponents: ComponentFact[];
  blueprint: string[];
}

export function normalizeHex(val: string): string {
  let hex = val.trim().toUpperCase().replace(/^#/, "");
  // Expand 3-char hex: FFF -> FFFFFF
  if (hex.length === 3) {
    hex = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  } else if (hex.length === 8 && (hex.startsWith("FF") || hex.endsWith("FF"))) {
    // Drop full opacity alpha prefix (ARGB) or suffix (RGBA) if all Fs
    if (hex.startsWith("FF")) hex = hex.slice(2);
    else if (hex.endsWith("FF")) hex = hex.slice(0, 6);
  }
  return `#${hex}`;
}

function collectColors(nodes: UnifiedNode[], directColors: UnifiedColorSpec[] = [], seen = new Set<string>()): string[] {
  for (const c of directColors) {
    if (typeof c === "string") {
      seen.add(normalizeHex(c));
    } else if (c && typeof c === "object" && "hex" in c && c.hex) {
      seen.add(normalizeHex(c.hex));
    }
  }

  function walk(nodeList: UnifiedNode[]) {
    for (const n of nodeList) {
      if (n.color) seen.add(normalizeHex(n.color));
      if (n.children && Array.isArray(n.children)) {
        walk(n.children);
      }
    }
  }

  walk(nodes);
  return Array.from(seen);
}

/**
 * Generate a Grounding Manifest matching design colors and symbols to local project symbols.
 */
export function generateGroundingManifest(
  nodes: UnifiedNode[],
  screenName = "ExtractedScreen",
  context?: ProjectGroundingContext,
  directColors: UnifiedColorSpec[] = [],
): GroundingManifest {
  const designColors = collectColors(nodes, directColors);
  const matchedTokens: MatchedDesignToken[] = [];
  const matchedHexes = new Set<string>();

  if (context?.colorTokens && context.colorTokens.length > 0) {
    for (const hex of designColors) {
      const normDesignHex = normalizeHex(hex);
      const match = context.colorTokens.find((ct) => normalizeHex(ct.hex) === normDesignHex);
      if (match && !matchedHexes.has(normDesignHex)) {
        matchedHexes.add(normDesignHex);
        matchedTokens.push({
          hex: match.hex,
          token: match.token,
          sourceFile: match.sourceFile,
          importStatement: match.importStatement,
        });
      }
    }
  }

  const reusableComponents: ComponentFact[] = (context?.components || []).filter(
    (c) => c.name.toLowerCase() !== screenName.toLowerCase(),
  );

  const matchedComponents: MatchedComponentMapping[] = [];
  const seenMappings = new Set<string>();

  function findNodeMappings(nodeList: UnifiedNode[]) {
    for (const n of nodeList) {
      if (n.name) {
        const match = matchComponent(n.name, reusableComponents, screenName);
        if (match.matched && match.component && !seenMappings.has(match.component.name)) {
          seenMappings.add(match.component.name);
          matchedComponents.push({
            designNodeName: n.name,
            localComponentName: match.component.name,
            path: match.component.path,
            confidence: match.confidence,
            sampleUsage: match.component.sampleUsage,
          });
        }
      }
      if (n.children && Array.isArray(n.children)) {
        findNodeMappings(n.children);
      }
    }
  }

  findNodeMappings(nodes);

  return {
    screenName,
    uiStack: context?.androidUIStack,
    matchedTokens,
    matchedComponents,
    reusableComponents,
    blueprint: formatTreeBlueprint(nodes, 0),
  };
}

/**
 * Format a Grounding Manifest into concise Markdown for agent consumption.
 */
export function formatGroundingManifestMarkdown(manifest: GroundingManifest): string {
  const lines: string[] = [
    `# Design Grounding Manifest: ${manifest.screenName}`,
    "",
    `| Parameter | Value |`,
    `| --- | --- |`,
    `| Target UI Stack | \`${manifest.uiStack || "compose"}\` |`,
    "",
    "## Mapped Local Design Tokens",
  ];

  if (manifest.matchedTokens.length === 0) {
    lines.push("_No direct token matches found. Use project theme colors or declare tokens._");
  } else {
    for (const t of manifest.matchedTokens) {
      const imp = t.importStatement ? ` (\`${t.importStatement}\`)` : "";
      lines.push(`- \`${t.hex}\` → \`${t.token}\` (from \`${t.sourceFile}\`)${imp}`);
    }
  }

  lines.push("", "## Mapped Reusable Components (Direct Blueprint Match)");
  if (manifest.matchedComponents.length === 0) {
    lines.push("_No direct matches. Review the discovered local components below for candidates._");
  } else {
    for (const mc of manifest.matchedComponents) {
      const sample = mc.sampleUsage ? ` — e.g. \`${mc.sampleUsage}\`` : "";
      lines.push(`- Design \`'${mc.designNodeName}'\` → Use **\`${mc.localComponentName}()\`** (\`${mc.path}\`)${sample} [${mc.confidence}]`);
    }
  }

  lines.push("", "## All Available Local UI Components");
  if (manifest.reusableComponents.length === 0) {
    lines.push("_No matching local components discovered._");
  } else {
    for (const c of manifest.reusableComponents.slice(0, 15)) {
      const sample = c.sampleUsage ? ` — e.g. \`${c.sampleUsage}\`` : "";
      lines.push(`- **\`${c.name}\`** (\`${c.path}\`)${sample}`);
    }
  }

  lines.push("", "## UI Structure Blueprint", "```text");
  for (const line of manifest.blueprint) {
    lines.push(line);
  }
  lines.push("```");

  return lines.join("\n");
}
