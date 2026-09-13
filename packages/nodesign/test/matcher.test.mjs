import assert from "node:assert/strict";
import { normalizeComponentName, matchComponent } from "../dist/matcher.js";

// 1. Name normalization tests
assert.equal(normalizeComponentName("Primary Button"), "PrimaryButton");
assert.equal(normalizeComponentName("Component / Header Row"), "HeaderRow");
assert.equal(normalizeComponentName("Instance / Product Card"), "ProductCard");
assert.equal(normalizeComponentName("btn-submit"), "BtnSubmit");
assert.equal(normalizeComponentName("Icon_Back"), "IconBack");
assert.equal(normalizeComponentName("Button, State=Hover"), "Button");
assert.equal(normalizeComponentName("Frame 1000004648"), "1000004648");

// 2. Exact match
const mockComponents = [
  { name: "PrimaryButton", path: "ui/components/PrimaryButton.kt", sampleUsage: "PrimaryButton(text = \"Click\")" },
  { name: "TapatHeader", path: "ui/components/TapatHeader.kt" },
  { name: "OrderSummaryCard", path: "ui/screens/checkout/OrderSummaryCard.kt" },
];

const exactRes = matchComponent("PrimaryButton", mockComponents);
assert.equal(exactRes.matched, true);
assert.equal(exactRes.confidence, "EXACT");
assert.equal(exactRes.component.name, "PrimaryButton");

// 3. Normalized match ("Primary Button" -> "PrimaryButton")
const normRes = matchComponent("Primary Button", mockComponents);
assert.equal(normRes.matched, true);
assert.equal(normRes.confidence, "NORMALIZED");
assert.equal(normRes.component.name, "PrimaryButton");

// 4. Fuzzy / Suffix match ("Summary Card" -> "OrderSummaryCard")
const fuzzyRes = matchComponent("SummaryCard", mockComponents);
assert.equal(fuzzyRes.matched, true);
assert.equal(fuzzyRes.confidence, "FUZZY");
assert.equal(fuzzyRes.component.name, "OrderSummaryCard");

// 5. Generic containers should NOT match
assert.equal(matchComponent("Row", mockComponents).matched, false);
assert.equal(matchComponent("Column", mockComponents).matched, false);
assert.equal(matchComponent("Box", mockComponents).matched, false);
assert.equal(matchComponent("Frame", mockComponents).matched, false);

// 6. Root screen filtering
assert.equal(matchComponent("OrderSummaryCard", mockComponents, "OrderSummaryCard").matched, false);

console.log("matcher test ok");
