import assert from "node:assert/strict";
import { generateGroundingManifest, formatGroundingManifestMarkdown, normalizeHex } from "../dist/manifest.js";

// 1. Hex normalization
assert.equal(normalizeHex("#fff"), "#FFFFFF");
assert.equal(normalizeHex("#FFFFFF"), "#FFFFFF");
assert.equal(normalizeHex("#FFFFFFFF"), "#FFFFFF"); // 8-digit ARGB/RGBA with FF alpha
assert.equal(normalizeHex("#1E88E5"), "#1E88E5");

const mockNodes = [
  {
    name: "HeaderRow",
    type: "FRAME",
    layout: { width: 360, height: 56, direction: "ROW", gap: 8 },
    children: [
      {
        name: "AppTitle",
        type: "TEXT",
        text: "Checkout Screen",
        color: "#1E88E5",
        font: { fontSize: 18, fontWeight: "bold" },
      },
      {
        name: "SubmitButton",
        type: "COMPONENT",
        color: "#2878F0",
      },
    ],
  },
];

// Direct colors extracted from fills/strokes/screen
const directColors = [
  { hex: "#FFFFFF" },
  "#000000",
];

const mockContext = {
  colorTokens: [
    {
      hex: "#1E88E5",
      token: "AppColors.brandPrimary",
      sourceFile: "core/ui/theme/Color.kt",
      importStatement: "import com.app.core.ui.theme.AppColors",
    },
    {
      hex: "#2878F0",
      token: "AppColors.submitBlue",
      sourceFile: "core/ui/theme/Color.kt",
    },
    {
      hex: "#FFF", // 3-digit shorthand in local codebase
      token: "AppColors.white",
      sourceFile: "core/ui/theme/Color.kt",
    },
    {
      hex: "#FF000000", // 8-digit full opacity black in local codebase
      token: "AppColors.black",
      sourceFile: "core/ui/theme/Color.kt",
    },
  ],
  components: [
    {
      name: "SubmitButton",
      path: "core/ui/components/SubmitButton.kt",
      sampleUsage: "SubmitButton(onClick = {})",
    },
    {
      name: "CheckoutScreen",
      path: "ui/screens/CheckoutScreen.kt",
    },
  ],
};

// 2. Generate Manifest with direct colors and hex normalization
const manifest = generateGroundingManifest(mockNodes, "CheckoutScreen", mockContext, directColors);

assert.equal(manifest.screenName, "CheckoutScreen");
assert.equal(manifest.matchedTokens.length, 4);
assert(manifest.matchedTokens.some((t) => t.token === "AppColors.brandPrimary"));
assert(manifest.matchedTokens.some((t) => t.token === "AppColors.submitBlue"));
assert(manifest.matchedTokens.some((t) => t.token === "AppColors.white"));
assert(manifest.matchedTokens.some((t) => t.token === "AppColors.black"));

// 3. Component filtering: Should include SubmitButton but filter out the root CheckoutScreen itself
assert.equal(manifest.reusableComponents.length, 1);
assert.equal(manifest.reusableComponents[0].name, "SubmitButton");

// 4. Blueprint check
assert(manifest.blueprint.length > 0);
assert(manifest.blueprint.some((line) => line.includes("HeaderRow")));
assert(manifest.blueprint.some((line) => line.includes("AppTitle")));

// 5. Markdown formatting
const md = formatGroundingManifestMarkdown(manifest);
assert(md.includes("Design Grounding Manifest: CheckoutScreen"));
assert(md.includes("`#1E88E5` → `AppColors.brandPrimary`"));
assert(md.includes("**`SubmitButton`**"));

console.log("manifest test ok");
