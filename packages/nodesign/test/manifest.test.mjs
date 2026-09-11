import assert from "node:assert/strict";
import { generateGroundingManifest, formatGroundingManifestMarkdown } from "../dist/manifest.js";

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

// 1. Generate Manifest
const manifest = generateGroundingManifest(mockNodes, "CheckoutScreen", mockContext);

assert.equal(manifest.screenName, "CheckoutScreen");
assert.equal(manifest.matchedTokens.length, 2);
assert.equal(manifest.matchedTokens[0].token, "AppColors.brandPrimary");
assert.equal(manifest.matchedTokens[1].token, "AppColors.submitBlue");

// 2. Component filtering: Should include SubmitButton but filter out the root CheckoutScreen itself
assert.equal(manifest.reusableComponents.length, 1);
assert.equal(manifest.reusableComponents[0].name, "SubmitButton");

// 3. Blueprint check
assert(manifest.blueprint.length > 0);
assert(manifest.blueprint.some((line) => line.includes("HeaderRow")));
assert(manifest.blueprint.some((line) => line.includes("AppTitle")));

// 4. Markdown formatting
const md = formatGroundingManifestMarkdown(manifest);
assert(md.includes("Design Grounding Manifest: CheckoutScreen"));
assert(md.includes("`#1E88E5` → `AppColors.brandPrimary`"));
assert(md.includes("**`SubmitButton`**"));

console.log("manifest test ok");
