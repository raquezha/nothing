---
name: figma-standard
description: Build, standardize, and update Figma design systems and product files (Foundations -> Components -> Screens) using the NoDesign Token Standard proposal and zero-MCP local Figma hacks (HTML-first browser preview, one-shot local Figma plugins, batched html.to.design state imports, and local Figma settings inspection). Use when creating or refactoring a Figma file, turning a reference image or HTML mockup into editable Figma layers/variables, or generating a local Figma plugin escape hatch when Figma MCP is rate-limited or unreliable.
---

# Figma Standard (NoDesign Proposal & Local Escape-Hatch Workflow)

Build and standardize Figma files bottom-up (`Foundations` $\rightarrow$ `Components` $\rightarrow$ `Screens`) so that every variable, component, and layer maps deterministically to CSS, Kotlin (Jetpack Compose / KMP), and Swift (SwiftUI) under the **NoDesign Standard proposal** (`com.nodesign`).

## Hard Rules

1. **Do NOT rely on official Figma MCP read/write loops as the primary workflow.** Official Figma MCP calls burn Starter-tier quotas (20 calls/month) and produce drifted, un-tokenized layouts when prompted monolithically.
2. **Use the HTML-First + Local Figma Hacks loop instead:**
   - **Draft & iterate in HTML/CSS + browser preview first** (zero quota, instant visual inspection).
   - **Push to Figma via a generated local one-shot Figma plugin (`manifest.json` + `code.js`)** or **batched `html.to.design` imports** (see [local-figma-hacks.md](references/local-figma-hacks.md)).
   - **Inspect open Figma files locally** via Figma Desktop's local `settings.json` (`fileKey`, `node-id`, and thumbnail cache) before spending any API call.
3. **Never jump straight to `Screens`.** Every Figma file MUST be constructed bottom-up in 4 gates:
   - **Gate 1 — `Foundations` (Variables, Styles, & Side-by-Side Section Boards)**
   - **Gate 2 — `Components` (Atomic Building Blocks & Variant Sets)**
   - **Gate 3 — `Screens` & `States` (`Desktop`, `Tablet`, `Mobile`, plus interaction/lifecycle states)**
   - **Gate 4 — DTCG Token Export (`*.tokens.json`) & Visual Verification**
4. **Never expose internal company names in public skills, token namespaces, or examples.** Use the **`NoDesign`** codename and `$extensions["com.nodesign"]` in all generated artifacts.

---

## The 4-Gate Bottom-Up Workflow

### Gate 0: Local Preflight & Reference Lock

1. Check if Figma Desktop has the target file open by reading local `settings.json` (see [local-figma-hacks.md](references/local-figma-hacks.md#1-local-figma-desktop-state-inspection)).
2. Confirm that only **one tab** of the target Figma file is open before running a local plugin (duplicate tabs cause plugins to target the wrong tab).
3. If starting from a visual reference or prompt, build a self-contained HTML/CSS preview first and verify it in a headless browser before generating Figma nodes.

### Gate 1: `Foundations` Page (4 Collections + Section Boards)

1. **Create the 4 Variable Collections** (see [nodesign-token-standard.md](references/nodesign-token-grammar.md)):
   - `Tokens: Primitive` (mode: `Value`) — literal `colors/*`, `pixels/*`, `fonts/*`, `opacity/*`. **Scope: `NONE`** (hidden from pickers so designers only bind semantics).
   - `Color: Semantic` (modes: `Light`, `Dark`) — `theme/*`, `content/*`, `surface/*`, `outline/*`, `tag/*`. **MUST alias primitives**; no raw hex values.
   - `Breakpoints: Semantic` (modes: `Android`, `iOS`, optional `Web`, `Tablet`) — `layout/{breakpoint,columns,grid,gutter,margin,corner,spacing}/*`, `theme/{corner,size}/*`. **MUST alias `pixels/N`** (except `layout/columns/columns`).
   - `Localization: Semantic` (mode: `English` + product languages) — `cta/*`, `fields/*`, `paragraphs/*`, `nav/*`, `titles/*`, `empty-state/*`, `errors/*`.
2. **Set Variable Metadata**:
   - Every semantic variable MUST have a `$description`, explicit `scopes`, and platform `codeSyntax` (`WEB` `--surface-background`, `ANDROID` `AppColors.surfaceBackground`, `iOS` `AppColors.surfaceBackground`).
3. **Render Side-by-Side `Foundations` Section Boards**:
   - Lay out horizontal section boards on the `Foundations` page: `Cover`, `Colors`, `Typography`, `Spacing`, `Layout`, `Iconography` (and `Marks` when custom annotations/doodles exist).
   - Every board MUST use `primaryAxisSizingMode = 'AUTO'` so tables and swatches never clip.

### Gate 2: `Components` Pages (Atomic Building Blocks)

1. Only create pages for component groups the product actually uses (e.g., `Navigation`, `Article blocks`, `Home bits`, `Marks`, or a single `Components` page).
2. Follow strict component hygiene (see [nodesign-token-standard.md](references/nodesign-token-grammar.md#4-component-variant-and-layer-rules)):
   - **Singular Title Case ASCII** component names (`Button`, `Meeting Row`, `Writing Item`).
   - **Separate variant axes**: `Type`, `Size`, `State` (`Default`, `Hover`, `Pressed`, `Focused`, `Selected`, `Disabled`, `Loading`, `Error`).
   - **ASCII kebab-case role layers**: `container`, `label`, `leading-icon`, `trailing-icon`, `badge`, `avatar`, `title`, `subtitle`, `meta`, `divider`. Never leave `Frame 12` or `div` layer names.
   - Bind fills, strokes, radii, and paddings **exclusively to semantic variables**.

### Gate 3: `Screens` & `States` Pages

1. Name every screen frame `{Screen} / {State}` in Title Case ASCII (`Home / Default`, `Home / Hover`, `Meetings / Empty`, `Login / Error`, `Post / Desktop`, `Post / Mobile`).
2. Compose screens from Gate 2 component instances and Gate 1 tokens at real target dimensions (e.g., `1440px` Desktop, `768px` Tablet, `390px` Mobile, with `160px` spacing between frames).
3. Ensure all text nodesinside auto-layout columns set `textAutoResize = 'HEIGHT'` and `layoutAlign = 'STRETCH'` *after* `appendChild` so multi-line text never overlaps sibling layers.

### Gate 4: DTCG Token Export & Verification

1. Export or sync `tokens/*.tokens.json` using the **DTCG 2025.10** format (`$value`, `$type`, `$description`, `$extensions["com.nodesign"]`).
2. Stamp the plugin version in both the `Screens` header and the `figma.closePlugin("vX.Y — ...")` completion toast so you can verify the run landed in Figma Desktop.

---

## References

- [NoDesign Token Standard Proposal (Collections, ABNF Grammar, Scoping, & Code Syntax)](references/nodesign-token-grammar.md)
- [Local Figma Escape-Hatch Hacks (One-Shot Plugin Generator, HTML Batch Import, & Local State Inspection)](references/local-figma-hacks.md)
