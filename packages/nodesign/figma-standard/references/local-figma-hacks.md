# Local Figma Escape-Hatch Hacks (Zero-MCP Workflow)

Official Figma MCP read/write loops are rate-limited on Starter plans (20 calls/month) and prone to layout drift when building full design systems. Use these three local techniques to inspect, build, and update Figma files with zero MCP quota cost.

---

## 1. Local Figma Desktop State Inspection (Zero API Calls)

Before touching any network tool, inspect Figma Desktop's local `settings.json` to discover open files, `fileKey`, `node-id`, and cached thumbnails:

- **macOS**: `~/Library/Application Support/Figma/settings.json`
- **Linux (`figma-linux`)**: `~/.config/figma-linux/settings.json`

### Quick Extraction Snippet

```bash
python3 -c '
import json, pathlib
for p in [
    pathlib.Path.home() / "Library/Application Support/Figma/settings.json",
    pathlib.Path.home() / ".config/figma-linux/settings.json",
]:
    if p.exists():
        data = json.loads(p.read_text())
        for w in data.get("windows", data.get("windowsState", [])):
            for t in w.get("tabs", []):
                print("tab:", t.get("title"), "| path:", t.get("path"), "| params:", t.get("params"))
        for f in data.get("sharedRecentlyClosedHistory", data.get("recentFiles", []))[:5]:
            print("recent:", f.get("title") or f.get("name"), "| path:", f.get("path"))
        for ext in data.get("localFileExtensions", []):
            if ext.get("lastKnownName"):
                print("plugin:", ext.get("lastKnownName"), "| manifest:", ext.get("manifestPath"))
'
```

> **Duplicate Tab Guard:** If the target file appears in more than one open tab in `windowsState`, ask the user to close the extra tab before running a plugin shortcut so the run lands in the right tab.

---

## 2. The HTML-First + `html.to.design` Batched Import Hack

When exploring visual direction from a reference image or prompt:

1. **Reconstruct in HTML/CSS first**: Build the screen and its states in a local `.html` file using CSS custom properties (`--surface-background`, `--content-primary`, `--layout-spacing-m`) that already match the NoDesign token grammar.
2. **Verify in a local browser**: Render and inspect at real target widths (`1440px`, `768px`, `390px`) and fix typography, contrast, and spacing before touching Figma.
3. **Batch states into one import sheet**: To bypass free-tier import quotas in `html.to.design`, place all screen variants (`Default`, `Hover`, `Empty`, `Loading`, `Error`) side-by-side in a single HTML canvas, import once as editable layers, and split into `{Screen} / {State}` frames inside Figma.

---

## 3. The One-Shot Local Figma Plugin Escape Hatch (`manifest.json` + `code.js`)

To build or rebuild `Foundations` boards, variable collections, `Components`, and `Screens` deterministically inside Figma Desktop with zero API quota:

### `manifest.json`

```json
{
  "name": "NoDesign Foundations & Screens Builder",
  "id": "nodesign-figma-builder",
  "api": "1.0.0",
  "main": "code.js",
  "editorType": ["figma"],
  "documentAccess": "dynamic-page",
  "networkAccess": { "allowedDomains": ["none"] }
}
```

### Critical Figma Plugin API Rules (`code.js`)

1. **Always load every font weight upfront** before creating or modifying text nodes:
   ```js
   await figma.loadFontAsync({ family: "Inter", style: "Regular" });
   await figma.loadFontAsync({ family: "Inter", style: "Medium" });
   await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
   ```
2. **Prevent board clipping and text overlap** (the `v7.3` lesson):
   - Section boards and vertical screen containers MUST set:
     ```js
     board.layoutMode = "VERTICAL";
     board.primaryAxisSizingMode = "AUTO"; // Grow to fit tables, swatches, and children
     board.counterAxisSizingMode = "FIXED";
     ```
   - Multi-line text inside a fixed-width column MUST set `layoutAlign = "STRETCH"` and `textAutoResize = "HEIGHT"` **after** being appended to its parent auto-layout frame:
     ```js
     parentFrame.appendChild(textNode);
     textNode.layoutAlign = "STRETCH";
     textNode.textAutoResize = "HEIGHT";
     ```
3. **Concatenate inline styled text segments safely** (the `v7.7` `"IworkatAcme"` lesson):
   - When building a paragraph with mixed links or inline highlights, either use a single `TextNode` with `setRangeFills` / `setRangeTextDecoration` (preserving spaces in the full string) or, if wrapping words in horizontal auto-layout segments, explicitly include trailing spaces (`"word "`) or `itemSpacing = 4` so words never run together.
4. **Create Variables with Scopes, Descriptions, and Code Syntax**:
   ```js
   const primCol = figma.variables.createVariableCollection("Tokens: Primitive");
   const primMode = primCol.modes[0].modeId;
   primCol.renameMode(primMode, "Value");

   const paperVar = figma.variables.createVariable("colors/solid/paper/100", primCol, "COLOR");
   paperVar.scopes = []; // Primitives MUST have empty scopes
   paperVar.setValueForMode(primMode, { r: 0.992, g: 0.992, b: 0.988 });

   const semCol = figma.variables.createVariableCollection("Color: Semantic");
   const lightMode = semCol.modes[0].modeId;
   semCol.renameMode(lightMode, "Light");

   const bgVar = figma.variables.createVariable("surface/background", semCol, "COLOR");
   bgVar.description = "Primary page canvas background";
   bgVar.scopes = ["FRAME_FILL", "SHAPE_FILL"];
   bgVar.setVariableCodeSyntax("WEB", "--surface-background");
   bgVar.setVariableCodeSyntax("ANDROID", "AppColors.surfaceBackground");
   bgVar.setVariableCodeSyntax("iOS", "AppColors.surfaceBackground");
   bgVar.setValueForMode(lightMode, { type: "VARIABLE_ALIAS", id: paperVar.id });
   ```
5. **Scale SVGs by aspect ratio, never unconstrained**:
   ```js
   function makeSvgIcon(svgString, name, targetHeightPx) {
     const node = figma.createNodeFromSvg(svgString);
     node.name = name;
     if (node.height > 0) node.rescale(targetHeightPx / node.height);
     return node;
   }
   ```
6. **Version-stamp every run**:
   - Include the version (`vX.Y`) in both the canvas header and `figma.closePlugin("vX.Y — Built Foundations, Components, and Screens")` so you can immediately verify whether Figma executed the latest `code.js` or cached an older plugin path.
