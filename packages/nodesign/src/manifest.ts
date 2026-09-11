import type { ArchitectureType, ComponentFact } from "./types.js";
import type { ColorTokenFact } from "./android.js";
import type { FigmaNodeSpec, FigmaColorSpec } from "./figma.js";
import type { ZeplinNodeSpec, ZeplinColorSpec } from "./zeplin.js";
import { formatTreeBlueprint } from "./brief.js";

type UnifiedNode = FigmaNodeSpec | ZeplinNodeSpec;
type UnifiedColorSpec = FigmaColorSpec | ZeplinColorSpec | string;

export interface ProjectGroundingContext {
  components?: ComponentFact[];
  colorTokens?: ColorTokenFact[];
  architectureType?: ArchitectureType;
}

export interface MatchedDesignToken {
  hex: string;
  token: string;
  sourceFile: string;
  importStatement?: string;
}

export interface GroundingManifest {
  screenName: string;
  matchedTokens: MatchedDesignToken[];
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

  return {
    screenName,
    matchedTokens,
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

  lines.push("", "## Reusable Local Components");
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
