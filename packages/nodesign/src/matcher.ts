import type { ComponentFact } from "./types.js";

/**
 * Normalizes component or node names to a canonical PascalCase string.
 * Strips out design-tool fluff like "Component / ", "Instance / ", "Frame ", "Group ", punctuation, spaces.
 */
export function normalizeComponentName(rawName: string): string {
  if (!rawName) return "";
  let name = rawName.trim();

  // Strip prefixes: "Component / Button" -> "Button", "Instance/Card" -> "Card", "Frame 123" -> "123"
  name = name.replace(/^(?:component|instance|frame|group|variant|view|vector)\s*[/:\-_\s]\s*/i, "");

  // Strip trailing/leading variant indicators e.g. "Button, State=Hover" -> "Button"
  name = name.split(/[,=]/)[0].trim();

  // Remove non-alphanumeric except whitespace
  name = name.replace(/[^a-zA-Z0-9\s_-]/g, " ");

  // Convert to PascalCase words
  const parts = name.split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return "";

  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

export interface ComponentMatchResult {
  matched: boolean;
  confidence: "EXACT" | "NORMALIZED" | "FUZZY" | "NONE";
  component?: ComponentFact;
  reason?: string;
}

/**
 * Common layout wrapper names that should never be mapped to custom business components.
 */
const GENERIC_CONTAINERS = new Set([
  "Row", "Column", "Box", "Container", "Frame", "Group", "Section", "Wrapper", "Layout", "Content", "Element", "Item", "Line", "Divider", "Spacer", "Stack",
]);

/**
 * High-confidence component matcher.
 * Matches design layer name to local codebase component facts.
 */
export function matchComponent(
  designNodeName: string,
  localComponents: ComponentFact[] = [],
  rootScreenName?: string,
): ComponentMatchResult {
  const normDesign = normalizeComponentName(designNodeName);
  if (!normDesign || GENERIC_CONTAINERS.has(normDesign)) {
    return { matched: false, confidence: "NONE" };
  }

  // Filter out components that are the root screen itself
  const candidates = localComponents.filter(
    (c) => c.name.toLowerCase() !== rootScreenName?.toLowerCase(),
  );

  // 1. Exact string match (case-insensitive)
  const exact = candidates.find(
    (c) => c.name.toLowerCase() === designNodeName.toLowerCase() || c.name === designNodeName,
  );
  if (exact) {
    return { matched: true, confidence: "EXACT", component: exact, reason: `Exact name match: '${exact.name}'` };
  }

  // 2. Normalized PascalCase match ("Primary Button" -> "PrimaryButton")
  const normMatch = candidates.find(
    (c) => normalizeComponentName(c.name).toLowerCase() === normDesign.toLowerCase(),
  );
  if (normMatch) {
    return { matched: true, confidence: "NORMALIZED", component: normMatch, reason: `Normalized match: '${designNodeName}' -> '${normMatch.name}'` };
  }

  // 3. Substring / Suffix containment match with length threshold
  // e.g. Design: "SubmitButton" or "Button", Code: "PrimaryButton" or "AppSubmitButton"
  if (normDesign.length >= 4) {
    const normDesignLower = normDesign.toLowerCase();
    // High-confidence prefix/suffix check
    const containment = candidates.find((c) => {
      const cNorm = normalizeComponentName(c.name).toLowerCase();
      if (cNorm.length < 4) return false;
      // e.g. "PrimaryButton" ends with "Button"
      return cNorm.endsWith(normDesignLower) || normDesignLower.endsWith(cNorm);
    });

    if (containment) {
      return { matched: true, confidence: "FUZZY", component: containment, reason: `Suffix/prefix match: '${designNodeName}' ~ '${containment.name}'` };
    }
  }

  return { matched: false, confidence: "NONE" };
}
