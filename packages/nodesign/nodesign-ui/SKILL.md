---
name: nodesign-ui
description: Implement production UI from Figma or Zeplin into Web (Astro/React/HTML/CSS), Android Jetpack Compose, Kotlin Multiplatform (KMP), or iOS SwiftUI using the NoDesign 4-gate bottom-up workflow (Preflight -> Tokens -> Atomic Components -> Screens -> Visual Diff). Use whenever implementing a screen, component, or design system from Figma, Zeplin, or a local Figma plugin spec.
---

# NoDesign UI Implementation (`nodesign-ui`)

Implement UI from Figma or Zeplin deterministically across **Web**, **Android Jetpack Compose**, **Kotlin Multiplatform (`commonMain`)**, and **iOS SwiftUI** without silent design drift.

## Hard Rules

1. **Never implement a full screen from a prompt or existing repo code alone.** Existing prototype code in a repo is NOT the Figma design.
2. **Never silently fall back to a stale local file when a design channel fails.** If Figma MCP is rate-limited or `nodesign preflight` reports `ambiguous`/`AUTH_REQUIRED`, **stop and report the block**—and if using a local plugin (`code.js`), local `settings.json`, or exported PNGs, verify the exact version (`vX.Y`) against the live Figma file first.
3. **Never jump straight to monolithic screen generation.** Execute the **4-Gate Bottom-Up Pipeline** in order:
   - **Gate 0 — Preflight & Spec Lock**
   - **Gate 1 — `Foundations` (Tokens & Intrinsic-Sized Assets)**
   - **Gate 2 — `Components` (Stateless Atomic Building Blocks & States)**
   - **Gate 3 — `Screens` (Composition & Responsive Breakpoints)**
   - **Gate 4 — Rendered Visual & Bounds Verification**
4. **Never override root SVG dimensions with broad container rules** (e.g., `.article img { width: 100%; height: auto; }` overriding a `14px` inline icon). Every exported SVG MUST have explicit intrinsic dimensions and a scoped class.

---

## The 4-Gate Bottom-Up Implementation Workflow

### Gate 0: Preflight & Spec Lock

1. Resolve the design source using the first available verified path:
   - **CLI path**: `npx @raquezha/nodesign preflight --json --path .` and `npx @raquezha/nodesign extract "<url>" --manifest --render --out ./renders`
   - **Local Figma Desktop escape hatch** (when cloud MCP/API is rate-limited):
     - Inspect `~/Library/Application Support/Figma/settings.json` (macOS) or `~/.config/figma-linux/settings.json` (Linux) for the active `fileKey`, `node-id`, `editedAt`, and thumbnail URL.
     - Check the version of any local one-shot plugin (`code.js`) or `*.tokens.json` file to ensure it matches the latest Figma revision.
2. Read BOTH the **`Foundations`** spec and the **`Screens`** spec before writing a single line of UI code.

### Gate 1: `Foundations` (Tokens & Assets)

1. Map the design's 4 collections (`Tokens: Primitive`, `Color: Semantic`, `Breakpoints: Semantic`, `Localization: Semantic`) into the target stack's token layer (see [stack-adapters.md](references/stack-adapters.md)):
   - **Web**: CSS custom properties (`--surface-background`, `--content-primary`, `--layout-spacing-m`) in `:root`.
   - **Compose / KMP**: `AppPrimitive`, `AppColors` (`CompositionLocal`), `AppLayout`, `AppStyles` in `commonMain`.
   - **SwiftUI**: `AppPrimitive`, `AppColors`, `AppLayout` enums/extensions.
2. Export every required SVG/image asset and lock its intrinsic `width` and `height`.

### Gate 2: `Components` (Atomic Building Blocks)

1. Implement leaf components in isolation before assembling screens (`Navigation` / back links, `Writing` row items, `Marks` / brush highlights, `Article blocks`, `Buttons`, `Cards`).
2. Implement all designed interaction states (`Default`, `Hover`, `Focus`, `Pressed`, `Disabled`, `Loading`, `Error`).
3. On Compose/SwiftUI, add `@Preview` / `#Preview` functions for every component variant.

### Gate 3: `Screens` (Composition & Layout Rhythm)

1. Compose each screen using **only** Gate 1 tokens and Gate 2 components.
2. Verify macro-layout widths, column alignments, and vertical rhythm (e.g., Home `550px` column vs. Post `680px` column; desktop left TOC rail vs. mobile top back-link placement).

### Gate 4: Rendered Visual & Bounds Verification ("Build Succeeded" Is Not Proof)

1. Render the actual UI across target viewports/configurations:
   - **Web**: Capture full-viewport and full-page screenshots at `1440px` (Desktop), `768px` (Tablet), and `390px` (Mobile) via headless Chrome CDP (`Emulation.setDeviceMetricsOverride`).
   - **Android / Compose**: Render `@Preview` functions via the Compose Preview runner (`android preview render --component-tree`), Paparazzi, or Roborazzi, and inspect both the PNG and the component bounds JSON.
2. Visually inspect the rendered PNGs against the Figma reference:
   - Check icon/SVG proportions, typography hierarchy, date/heading spacing, hover states, and responsive wrapping.
3. Fix every discrepancy and re-capture before marking the task complete.

---

## References

- [Stack Adapters (Web CSS, Jetpack Compose / KMP, SwiftUI)](references/stack-adapters.md)
