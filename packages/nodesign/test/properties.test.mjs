import assert from "node:assert/strict";
import {
  compareUiProperty,
  verifyUiProperties,
  normalizePropertyValue,
} from "../dist/index.js";

// 1. Normalization checks
assert.equal(normalizePropertyValue("#fff"), "#FFFFFF");
assert.equal(normalizePropertyValue("#6200EE"), "#6200EE");
assert.equal(normalizePropertyValue(" 16 dp "), "16dp");
assert.equal(normalizePropertyValue("Bold"), "bold");

// 2. Matching property
const matchProp = compareUiProperty({
  property: "textSize",
  expected: "16sp",
  actual: "16sp",
  tokenName: "Typography.bodyMedium",
});
assert.equal(matchProp.status, "MATCH");
assert.equal(matchProp.notes?.includes("matched"), true);

// 3. Misleading style token name (Same token name, different resolved values -> MISMATCH)
const misleadingTokenProp = compareUiProperty({
  property: "textColor",
  expected: "MaterialTheme.colorScheme.primary",
  actual: "MaterialTheme.colorScheme.primary",
  resolvedExpected: "#6200EE",
  resolvedActual: "#000000",
  tokenName: "MaterialTheme.colorScheme.primary",
  actualTokenName: "MaterialTheme.colorScheme.primary",
});
assert.equal(misleadingTokenProp.status, "MISMATCH");
assert.equal(misleadingTokenProp.resolvedExpected, "#6200EE");
assert.equal(misleadingTokenProp.resolvedActual, "#000000");
assert.equal(misleadingTokenProp.notes?.includes("mismatch"), true);

// 4. Unknown property (No resolved or actual value provided)
const unknownProp = compareUiProperty({
  property: "cornerRadius",
  expected: "8dp",
});
assert.equal(unknownProp.status, "UNKNOWN");

// 5. Waived property
const waivedProp = compareUiProperty({
  property: "stroke",
  expected: "1dp",
  actual: "2dp",
  waived: "Approved variation for dark mode outline",
});
assert.equal(waivedProp.status, "EXPLICITLY_WAIVED");
assert.equal(waivedProp.waiverReason, "Approved variation for dark mode outline");

// 6. Test all 14 property types
const all14Properties = [
  "iconWidth",
  "iconHeight",
  "iconColor",
  "textSize",
  "fontFamily",
  "fontWeight",
  "textColor",
  "backgroundColor",
  "padding",
  "margin",
  "spacing",
  "dimensions",
  "cornerRadius",
  "stroke",
  "opacity",
];

for (const prop of all14Properties) {
  const comp = compareUiProperty({
    property: prop,
    expected: "10",
    actual: "10",
  });
  assert.equal(comp.status, "MATCH");
}

// 7. Verification suite gating (exact-fidelity enforcement)
const passedInputs = [
  { property: "iconWidth", expected: "24dp", actual: "24dp" },
  { property: "iconColor", expected: "#111", actual: "#111111" },
  { property: "padding", expected: "16dp", actual: "24dp", waived: "Custom wide card padding" },
];

const resultPassed = verifyUiProperties(passedInputs, { exactFidelityRequired: true });
assert.equal(resultPassed.passed, true);
assert.equal(resultPassed.summary.match, 2);
assert.equal(resultPassed.summary.waived, 1);
assert.equal(resultPassed.summary.mismatch, 0);
assert.equal(resultPassed.summary.unknown, 0);

const failedInputs = [
  { property: "textSize", expected: "14sp", actual: "16sp" }, // MISMATCH
  { property: "fontFamily", expected: "Inter" }, // UNKNOWN
];

const resultFailed = verifyUiProperties(failedInputs, { exactFidelityRequired: true });
assert.equal(resultFailed.passed, false);
assert.equal(resultFailed.summary.mismatch, 1);
assert.equal(resultFailed.summary.unknown, 1);

// Non-exact fidelity override
const resultNonExact = verifyUiProperties(failedInputs, { exactFidelityRequired: false });
assert.equal(resultNonExact.passed, true);

console.log("properties verification suite test ok");
