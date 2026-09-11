import type { ArchitectureType, ComponentFact } from "./types.js";
import type { ColorTokenFact } from "./android.js";
import type { FigmaNodeSpec } from "./figma.js";
import type { ZeplinNodeSpec } from "./zeplin.js";
import { formatTreeBlueprint } from "./brief.js";

type UnifiedNode = FigmaNodeSpec | ZeplinNodeSpec;

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

function collectColors(nodes: UnifiedNode[], seen = new Set<string>()): string[] {
  for (const n of nodes) {
    if (n.color) seen.add(n.color.toUpperCase().trim());
    if (n.children && Array.isArray(n.children)) {
      collectColors(n.children, seen);
    }
  }
  return Array.from(seen);
}

/**
 * Generate a Grounding Manifest matching design colors and symbols to local project symbols.
 */
export function generateGroundingManifest(
  nodes: UnifiedNode[],
  screenName = "ExtractedScreen",
  context?: ProjectGroundingContext,
): GroundingManifest {
  const designColors = collectColors(nodes);
  const matchedTokens: MatchedDesignToken[] = [];

  if (context?.colorTokens && context.colorTokens.length > 0) {
    for (const hex of designColors) {
      const match = context.colorTokens.find((ct) => ct.hex.toUpperCase() === hex.toUpperCase());
      if (match) {
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
