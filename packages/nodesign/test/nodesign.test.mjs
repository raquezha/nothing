import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  parseDesignLink,
  determineEvidenceStatus,
  formatDesignBrief,
  formatTreeBlueprint,
  generateCodeSnippet,
  resolveCredentials,
  inspectAndroidProject,
} from "../dist/index.js";

function makeFixture(name, files) {
  const root = mkdtempSync(path.join(tmpdir(), `nodesign-fixture-${name}-`));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const roots = [];

try {
  // 1. Non-UI fixture
  const nonUi = makeFixture("non-ui", { "README.md": "Backend service" });
  roots.push(nonUi);
  const nonUiInspection = inspectAndroidProject(nonUi);
  const nonUiStatus = determineEvidenceStatus([], nonUiInspection.androidUIStack !== "n/a");
  assert.equal(nonUiInspection.androidUIStack, "n/a");
  assert.equal(nonUiStatus, "ready");

  // 2. UI-missing fixture (Android repo with no design links)
  const uiMissing = makeFixture("ui-missing", {
    "app/build.gradle.kts": 'dependencies { implementation("androidx.compose.ui:ui:1.0.0") }',
  });
  roots.push(uiMissing);
  const uiMissingInspection = inspectAndroidProject(uiMissing);
  const uiMissingStatus = determineEvidenceStatus([], uiMissingInspection.androidUIStack !== "n/a");
  assert.equal(uiMissingInspection.androidUIStack, "compose");
  assert.equal(uiMissingStatus, "missing");

  // 3. UI-ambiguous fixture (Figma URL missing node-id)
  const ambiguousUrl = "https://www.figma.com/design/tVN4mWwBlUlzWNUZGfaavK/Tindahang-Tapat";
  const parsedAmbiguous = parseDesignLink(ambiguousUrl);
  assert.equal(parsedAmbiguous.status, "ambiguous");
  assert.equal(parsedAmbiguous.link.provider, "figma");

  // 4. UI-ready fixture (Zeplin link)
  const zeplinUrl = "https://zpl.io/AOGOKp6";
  const parsedZeplin = parseDesignLink(zeplinUrl);
  assert.equal(parsedZeplin.status, "ready");
  assert.equal(parsedZeplin.link.provider, "zeplin");

  const parsedZeplinUri = parseDesignLink("zpl://screen/AOGOKp6");
  assert.equal(parsedZeplinUri.status, "ready");
  assert.equal(parsedZeplinUri.link.provider, "zeplin");

  // 5. Tindahang Tapat 3 experiment screens fixtures
  const screens = [
    {
      name: "REPORTS",
      zeplin: "https://zpl.io/AOGOKp6",
      figma: "https://www.figma.com/design/tVN4mWwBlUlzWNUZGfaavK/Tindahang-Tapat?node-id=16219-5858",
    },
    {
      name: "SUGGESTIONS",
      zeplin: "https://zpl.io/5NgNj8n",
      figma: "https://www.figma.com/design/tVN4mWwBlUlzWNUZGfaavK/Tindahang-Tapat?node-id=16219-6267",
    },
    {
      name: "CHECKOUT",
      zeplin: "https://zpl.io/jplpy0m",
      figma: "https://www.figma.com/design/tVN4mWwBlUlzWNUZGfaavK/Tindahang-Tapat?node-id=16219-6561",
    },
  ];

  for (const screen of screens) {
    const pZeplin = parseDesignLink(screen.zeplin);
    assert.equal(pZeplin.status, "ready", `${screen.name} Zeplin link should be ready`);
    assert.equal(pZeplin.link.provider, "zeplin");

    const pFigma = parseDesignLink(screen.figma);
    assert.equal(pFigma.status, "ready", `${screen.name} Figma link with node-id should be ready`);
    assert.equal(pFigma.link.provider, "figma");
  }

  // 6. Brief Formatter JSON & Human outputs
  const samplePreflight = {
    uiSensitive: true,
    androidUIStack: "compose",
    evidenceStatus: "ready",
    designLinks: [{ provider: "zeplin", url: "https://zpl.io/AOGOKp6", label: "Zeplin screen" }],
    resolvedScreens: [{
      status: "SUCCESS",
      screen: {
        id: "AOGOKp6",
        name: "Reports Screen",
        width: 360,
        height: 640,
        colors: [{ r: 40, g: 120, b: 240, a: 1, hex: "#2878F0" }],
        layerNames: ["Header"],
      },
      savedAssets: [".workflow/tasks/github-99/evidence/ic_reports.svg"],
    }],
    components: [{ name: "PrimaryButton", path: "ui/components/PrimaryButton.kt" }],
    notes: ["Found 1 reusable ui/components file(s)"],
  };

  const humanBrief = formatDesignBrief("github:101", samplePreflight, "human");
  assert(humanBrief.includes("Design Brief: github:101"));
  assert(humanBrief.includes("UI Sensitive: yes"));
  assert(humanBrief.includes("Android UI Stack: compose"));
  assert(humanBrief.includes("Reports Screen"));
  assert(humanBrief.includes("#2878F0"));
  assert(humanBrief.includes("PrimaryButton"));

  const jsonBriefStr = formatDesignBrief("github:101", samplePreflight, "json");
  const jsonBrief = JSON.parse(jsonBriefStr);
  assert.equal(jsonBrief.taskId, "github:101");
  assert.equal(jsonBrief.preflight.evidenceStatus, "ready");
  assert.equal(jsonBrief.preflight.components[0].name, "PrimaryButton");

  // 7. Auth Credentials Resolver
  const creds = resolveCredentials();
  assert(typeof creds === "object");

  // 8. Tree Blueprint Formatter
  const treeNodes = [
    {
      name: "Header",
      type: "FRAME",
      layout: { width: 360, height: 56, direction: "ROW" },
      color: "#2878F0",
      children: [
        { name: "TitleText", text: "Checkout", font: { fontFamily: "Inter", fontSize: 18, fontWeight: 600 }, color: "#FFFFFF" },
      ],
    },
  ];
  const blueprintLines = formatTreeBlueprint(treeNodes);
  assert.equal(blueprintLines.length, 2);
  assert(blueprintLines[0].includes("[FRAME] Header"));
  assert(blueprintLines[0].includes("360x56"));
  assert(blueprintLines[1].includes("text=\"Checkout\""));
  assert(blueprintLines[1].includes("Inter"));

  // 9. Code Snippet Generator (Compose, React, HTML)
  const codeContext = {
    components: [{ name: "Header", path: "ui/components/Header.kt" }],
    colorTokens: [{ hex: "#2878F0", token: "TapatColors.brandPrimary", sourceFile: "Color.kt", packageName: "com.tapat.app.ui.theme", importStatement: "import com.tapat.app.ui.theme.TapatColors" }],
  };
  const composeCode = generateCodeSnippet(treeNodes, "compose", "CheckoutScreen", codeContext);
  assert(composeCode.includes("import androidx.compose.runtime.Composable"));
  assert(composeCode.includes("import com.tapat.app.ui.theme.TapatColors"));
  assert(composeCode.includes("fun CheckoutScreen()"));
  assert(composeCode.includes("Reusing discovered component: ui/components/Header.kt"));
  assert(composeCode.includes("Header()"));

  const reactCode = generateCodeSnippet(treeNodes, "react", "CheckoutScreen");
  assert(reactCode.includes("export function CheckoutScreen()"));
  assert(reactCode.includes("<span"));
  assert(reactCode.includes("Checkout</span>"));

  const htmlCode = generateCodeSnippet(treeNodes, "html", "CheckoutScreen");
  assert(htmlCode.includes("<div class=\"checkoutscreen\">"));
  assert(htmlCode.includes("Checkout</span>"));

  console.log("nodesign suite test ok");
} finally {
  for (const p of roots) rmSync(p, { recursive: true, force: true });
}
