# Stack Adapters (`Web`, `Compose / KMP`, `SwiftUI`)

How the **NoDesign Standard** (`com.nodesign`) maps into each target UI stack during Gates 1–4.

---

## 1. Naming Derivation Table

| Surface | Rule | `surface/background` | `colors/solid/paper/300` | `layout/spacing/l` | `cta/sign-in-gitlab` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Figma Variable** | `/` groups | `surface/background` | `colors/solid/paper/300` | `layout/spacing/l` | `cta/sign-in-gitlab` |
| **DTCG JSON** | `/` $\rightarrow$ `.` | `surface.background` | `colors.solid.paper.300` | `layout.spacing.l` | `cta.sign-in-gitlab` |
| **Web (CSS)** | `--` + `/` $\rightarrow$ `-` | `--surface-background` | `--colors-solid-paper-300` | `--layout-spacing-l` | N/A |
| **Kotlin (`commonMain`)** | `App{Collection}.{camelCase}` | `AppColors.surfaceBackground` | `AppPrimitive.colorsSolidPaper300` | `AppLayout.layoutSpacingL` | `Res.string.cta_sign_in_gitlab` |
| **Swift (`SwiftUI`)** | `App{Collection}.{camelCase}` | `AppColors.surfaceBackground` | `AppPrimitive.colorsSolidPaper300` | `AppLayout.layoutSpacingL` | `String(localized: "cta_sign_in_gitlab")` |

---

## 2. Web Adapter (Astro / HTML / CSS / React)

- **Tokens (Gate 1)**:
  - Define all semantic tokens in `:root` (`--surface-*`, `--content-*`, `--outline-*`, `--layout-spacing-*`, `--mark-*`).
  - Never hardcode hex values in component/screen rules when a semantic token exists.
- **SVG & Image Safety (Gate 1–2)**:
  - Always include explicit `width` and `height` HTML attributes on `<img>` and `<svg>` elements.
  - Scope article/prose image rules (`.post img:not(.post-doodle)`) so inline icons (`.home-cat`, `.footer-cat`, `.back-icon`) never inherit `width: 100%; height: auto;`.
- **Hand-Drawn Brush Highlights (`<mark>`)**:
  - Use inline SVG `background-image` + `box-decoration-break: clone; -webkit-box-decoration-break: clone;` with `background-position: 0.34em 0; background-size: calc(100% - 0.34em) 100%; padding: 0.08em 8px 0.12em 0;` so strokes start mid-first-letter and extend `~8px` past the end on every wrapped line.
- **Visual Verification (Gate 4)**:
  - Use Chrome DevTools Protocol (`Emulation.setDeviceMetricsOverride` with `deviceScaleFactor: 2`) for exact `1440px`, `768px`, and `390px` captures (`chrome --headless --window-size` on macOS clamps narrow widths to ~500px unless CDP device emulation is used).

---

## 3. Android Jetpack Compose & KMP Adapter (`commonMain`)

- **Tokens (Gate 1)**:
  - Generate `AppPrimitive`, `AppColors` (`light` and `dark` instances via `staticCompositionLocalOf`), and `AppLayout` in `commonMain`.
  - Bridge semantic roles (`surfaceBackground`, `contentPrimary`, `themePrimary400`) into `MaterialTheme.colorScheme` so M3 components inherit the theme automatically.
  - In KMP `commonMain`, never import `android.*` or `LocalContext`; use `composeResources` (`Res.drawable.*`, `Res.string.*`).
- **Components (Gate 2)**:
  - Follow the 1:1 Figma property mapping:
    ```kotlin
    @Composable
    fun AppButton(
        label: String,
        onClick: () -> Unit,
        modifier: Modifier = Modifier,
        type: ButtonType = ButtonType.Primary,
        size: ButtonSize = ButtonSize.Default,
        enabled: Boolean = true,
        loading: Boolean = false,
    )
    ```
  - Always place `modifier: Modifier = Modifier` as the first optional parameter and apply it to the root layout node only.
- **Visual Verification (Gate 4)**:
  - Write `@Preview` functions for each state (`Default`, `Loading`, `Empty`, `Error`, `Dark`).
  - Render via the Compose Preview sidecar (`android preview render --component-tree`), Paparazzi, or Roborazzi, and inspect both the rendered PNG and the component bounds tree (`bounds`, `modifiers`, `semantics`).

---

## 4. iOS SwiftUI Adapter

- **Tokens (Gate 1)**:
  - Generate `enum AppPrimitive`, `enum AppColors`, and `enum AppLayout` (or Asset Catalog color sets with Any/Dark appearances matching the §1 names).
- **Components (Gate 2)**:
  - Map Figma variant properties to Swift enums (`ButtonType.primary`, `ButtonSize.default`) and state flags (`isEnabled`, `isLoading`).
- **Visual Verification (Gate 4)**:
  - Provide `#Preview` macros for each variant and verify against the Figma frame render.
