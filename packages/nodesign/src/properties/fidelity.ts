export function normalizePropertyValue(val: string): string {
  const trimmed = val.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
    let hex = trimmed.toUpperCase();
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    return hex;
  }
  return trimmed.replace(/\s+/g, "").toLowerCase();
}

export interface UiFidelityReport {
  fidelityScore: number;
  passed: boolean;
  colorTokenCompliance: {
    totalColors: number;
    rawHexLeaks: string[];
    reusedTokens: string[];
  };
  componentReuseCompliance: {
    expectedComponents: string[];
    reusedComponents: string[];
    missingComponents: string[];
  };
  notes: string[];
}

export function verifyUiFidelity(
  extractedHierarchy: any[],
  extractedColors: any[],
  codeText: string,
): UiFidelityReport {
  const notes: string[] = [];
  const reusedComponents: string[] = [];
  const missingComponents: string[] = [];
  const rawHexLeaks: string[] = [];
  const reusedTokens: string[] = [];

  const expectedComponents: string[] = [];
  const collectComponents = (nodes: any[]): void => {
    for (const node of nodes || []) {
      const name = typeof node.name === "string" ? node.name.replace(/[^a-zA-Z0-9]/g, "") : "";
      if (name.length > 2 && !["Row", "Column", "Box", "Container", "Frame"].includes(name)) {
        expectedComponents.push(name);
      }
      if (Array.isArray(node.children)) collectComponents(node.children);
    }
  };
  collectComponents(extractedHierarchy);

  for (const comp of expectedComponents) {
    const reg = new RegExp(`\\b${comp}\\b`, "i");
    if (reg.test(codeText)) {
      reusedComponents.push(comp);
    } else {
      missingComponents.push(comp);
    }
  }

  const rawColorMatches = codeText.matchAll(/Color\(\s*0x[0-9a-fA-F]+\s*\)/gi);
  for (const m of rawColorMatches) {
    rawHexLeaks.push(m[0]);
  }

  const compScore = expectedComponents.length === 0
    ? 100
    : (reusedComponents.length / expectedComponents.length) * 100;
  const hexPenalty = Math.min(40, rawHexLeaks.length * 10);
  const fidelityScore = Math.max(0, Math.round(compScore - hexPenalty));
  const passed = fidelityScore >= 80 && missingComponents.length === 0;

  if (missingComponents.length > 0) {
    notes.push(`Missing reused design system components: ${missingComponents.join(", ")}`);
  }
  if (rawHexLeaks.length > 0) {
    notes.push(`Detected ${rawHexLeaks.length} raw hex color leak(s) instead of theme tokens.`);
  }

  return {
    fidelityScore,
    passed,
    colorTokenCompliance: {
      totalColors: extractedColors.length,
      rawHexLeaks,
      reusedTokens,
    },
    componentReuseCompliance: {
      expectedComponents,
      reusedComponents,
      missingComponents,
    },
    notes,
  };
}
