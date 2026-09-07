import type {
  PropertyVerificationResult,
  UiPropertyComparison,
  UiPropertyInput,
  UiPropertyStatus,
} from "./types.js";

/** Normalize color, length, or string property values for comparison. */
export function normalizePropertyValue(val: string): string {
  const trimmed = val.trim();
  // Normalize hex color strings (#fff -> #ffffff, case-insensitive)
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
    let hex = trimmed.toUpperCase();
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    return hex;
  }
  // Normalize numeric dimensions with whitespace (e.g., "16 dp" -> "16dp")
  return trimmed.replace(/\s+/g, "").toLowerCase();
}

/** Compare a single UI property spec against resolved actual implementation value. */
export function compareUiProperty(input: UiPropertyInput): UiPropertyComparison {
  const resolvedExpected = input.resolvedExpected ?? input.expected;
  const resolvedActual = input.resolvedActual ?? input.actual;

  // 1. Explicitly waived
  if (input.waived) {
    const waiverReason = typeof input.waived === "string" ? input.waived : "Explicitly waived";
    return {
      property: input.property,
      expected: input.expected,
      actual: input.actual,
      resolvedExpected,
      resolvedActual,
      status: "EXPLICITLY_WAIVED",
      tokenName: input.tokenName,
      actualTokenName: input.actualTokenName,
      waiverReason,
      notes: `Property waived: ${waiverReason}`,
    };
  }

  // 2. Unknown actual value
  if (resolvedActual === undefined || resolvedActual === null) {
    return {
      property: input.property,
      expected: input.expected,
      actual: input.actual,
      resolvedExpected,
      resolvedActual,
      status: "UNKNOWN",
      tokenName: input.tokenName,
      actualTokenName: input.actualTokenName,
      notes: "Actual resolved value unavailable or unresolvable",
    };
  }

  // 3. Compare resolved values (not just token names)
  const normExpected = normalizePropertyValue(resolvedExpected);
  const normActual = normalizePropertyValue(resolvedActual);

  const isMatch = normExpected === normActual;
  const status: UiPropertyStatus = isMatch ? "MATCH" : "MISMATCH";

  const notes = isMatch
    ? `Resolved value matched (${normExpected})`
    : `Resolved value mismatch: expected '${resolvedExpected}', got '${resolvedActual}'`;

  return {
    property: input.property,
    expected: input.expected,
    actual: input.actual,
    resolvedExpected,
    resolvedActual,
    status,
    tokenName: input.tokenName,
    actualTokenName: input.actualTokenName,
    notes,
  };
}

export interface UiFidelityReport {
  fidelityScore: number; // 0 - 100
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

  // 1. Check Component Reuse
  const expectedComponents = extractedHierarchy
    .map((node) => typeof node.name === "string" ? node.name.replace(/[^a-zA-Z0-9]/g, "") : "")
    .filter((n) => n.length > 2 && !["Row", "Column", "Box", "Container", "Frame"].includes(n));

  for (const comp of expectedComponents) {
    const reg = new RegExp(`\\b${comp}\\b`, "i");
    if (reg.test(codeText)) {
      reusedComponents.push(comp);
    } else {
      missingComponents.push(comp);
    }
  }

  // 2. Check Raw Hex Leaks vs Theme Tokens
  const rawColorMatches = codeText.matchAll(/Color\(\s*0x[0-9a-fA-F]+\s*\)/gi);
  for (const m of rawColorMatches) {
    rawHexLeaks.push(m[0]);
  }

  // 3. Compute Fidelity Score
  const totalCompCheck = expectedComponents.length || 1;
  const compScore = (reusedComponents.length / totalCompCheck) * 100;
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

/** Verify a list of UI properties against resolved Android UI implementation evidence. */
export function verifyUiProperties(
  inputs: UiPropertyInput[],
  options: { exactFidelityRequired?: boolean } = {},
): PropertyVerificationResult {
  const exactFidelityRequired = options.exactFidelityRequired ?? true;
  const comparisons = inputs.map(compareUiProperty);

  const summary = {
    match: 0,
    mismatch: 0,
    unknown: 0,
    waived: 0,
  };

  for (const c of comparisons) {
    switch (c.status) {
      case "MATCH":
        summary.match++;
        break;
      case "MISMATCH":
        summary.mismatch++;
        break;
      case "UNKNOWN":
        summary.unknown++;
        break;
      case "EXPLICITLY_WAIVED":
        summary.waived++;
        break;
    }
  }

  const passed = exactFidelityRequired
    ? summary.mismatch === 0 && summary.unknown === 0
    : true;

  return {
    exactFidelityRequired,
    passed,
    comparisons,
    summary,
  };
}

/** Format a PropertyVerificationResult into human-readable text or JSON string. */
export function formatPropertyVerification(
  result: PropertyVerificationResult,
  format: "json" | "human" = "human",
): string {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }

  const lines: string[] = [
    `Property Verification: ${result.passed ? "PASSED" : "FAILED"}`,
    `Exact Fidelity Required: ${result.exactFidelityRequired ? "yes" : "no"}`,
    `Summary: ${result.summary.match} match, ${result.summary.mismatch} mismatch, ${result.summary.unknown} unknown, ${result.summary.waived} waived`,
  ];

  if (result.comparisons.length > 0) {
    lines.push("", "Comparisons:");
    for (const c of result.comparisons) {
      lines.push(`  - [${c.status}] ${c.property}: expected='${c.expected}', actual='${c.actual ?? "unspecified"}'`);
      if (c.notes) lines.push(`    note=${c.notes}`);
    }
  }

  return lines.join("\n");
}

