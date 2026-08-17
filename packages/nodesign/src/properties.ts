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
