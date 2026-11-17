# NoDesign Token Standard Proposal (`com.nodesign`)

Distilled reference of the **NoDesign Standard** (the mobile/web engineering proposal built on the [W3C Design Tokens Community Group Format Module 2025.10](https://www.designtokens.org/tr/2025.10/format/)).

---

## 1. The 4 Collections & Tiers

Every conforming Figma file and token repository uses four variable collections plus two non-variable style/code groups:

| Collection (Figma) | Tier | Modes | JSON Top-Level Groups | Value Rule |
| :--- | :--- | :--- | :--- | :--- |
| `Tokens: Primitive` | primitive | `Value` | `colors`, `pixels`, `fonts`, `opacity` | **MUST** be literal. **Scopes: `NONE`**. |
| `Color: Semantic` | semantic | `Light`, `Dark` | `theme/{primary,secondary,tertiary,success,warning,alert}`, `content`, `surface`, `outline`, `tag`, `theme/opacity`, `theme/status` | **MUST** alias primitives (`{colors.coral.400}`). No raw hex colours. |
| `Breakpoints: Semantic` | semantic | `Android`, `iOS` (+ `Web`, `Tablet`) | `layout/{breakpoint,columns,grid,gutter,margin,corner,spacing}`, `theme/corner`, `theme/size` | **MUST** alias `pixels/N` (except `layout/columns/columns`, which is a raw `number`). |
| `Localization: Semantic` | semantic | `English` + product locales | `strings/localization.json` (`cta`, `fields`, `paragraphs`, `nav`, `titles`, `empty-state`, `errors`) | Purpose-named keys (`cta/sign-in-gitlab`). |
| *Styles* (Figma Text & Effect Styles) | semantic | – | `typography`, `elevation` | Composite members (`fontFamily`, `fontSize`, `fontWeight`, shadow `color`) alias primitives. |
| *Code only* | primitive | – | `motion`, `z` | Literal (`ms`, `cubicBezier`, z-index integers). |

> **Figma Starter Plan Note:** Starter allows 1 mode per collection. Keep `Value`, `Light`, `Android`, and `English` in Figma variables, and store secondary modes (`Dark`, `iOS`, extra locales) in `tokens/*.tokens.json` override files. Never duplicate collections to fake modes.

---

## 2. Naming Grammar & Scales

```text
{group}/{subgroup}/{name}            Figma variable / style name
{group}.{subgroup}.{name}            DTCG JSON path
--{group}-{subgroup}-{name}          CSS custom property
App{Collection}.{camelCaseName}      Kotlin (Compose / KMP) & Swift (SwiftUI)
```

### Rules
- **Lower-case kebab-case only**: `^[a-z0-9]+(-[a-z0-9]+)*$` per segment, 2 to 4 segments separated by `/`.
- **Forbidden characters**: spaces (`colors/bright orange/100` $\rightarrow$ `colors/bright-orange/100`), capitals, underscores, dots, braces, `$`, and non-ASCII characters (no en-dashes `–` or curly quotes).
- **Monotonic scales**:
  - **Alpha ramps**: `100` (16%), `200` (48%), `300` (72%), `400` (100%).
  - **Solid ramps**: `colors/solid/<family>/<100..900>` ordered light to dark.
  - **T-shirt sizes**: `xxs` (2px) · `xs` (4px) · `s` (8px) · `m` (12px or 16px per profile, must increase monotonically) · `l` · `xl` · `xxl`.
  - **Pixels**: `pixels/N` where `N` is the exact pixel value (`pixels/1-5` = `1.5px`).
  - **Elevation**: `elevation/100` through `elevation/500`.

### One Name Across All Platforms

| Platform | Rule | `surface/background` | `colors/solid/paper/300` | `layout/spacing/l` |
| :--- | :--- | :--- | :--- | :--- |
| **Figma variable** | `/` groups | `surface/background` | `colors/solid/paper/300` | `layout/spacing/l` |
| **DTCG JSON** | `/` $\rightarrow$ `.` | `surface.background` | `colors.solid.paper.300` | `layout.spacing.l` |
| **CSS** | `--` + `/` $\rightarrow$ `-` | `--surface-background` | `--colors-solid-paper-300` | `--layout-spacing-l` |
| **Kotlin (`commonMain`)** | `AppColors` / `AppLayout` / `AppPrimitive` | `AppColors.surfaceBackground` | `AppPrimitive.colorsSolidPaper300` | `AppLayout.layoutSpacingL` |
| **Swift (`SwiftUI`)** | `AppColors` / `AppLayout` / `AppPrimitive` | `AppColors.surfaceBackground` | `AppPrimitive.colorsSolidPaper300` | `AppLayout.layoutSpacingL` |

---

## 3. Required Figma Variable Scoping

Setting scopes prevents designers and agents from accidentally binding primitives or wrong token categories:

| Variable Group | Required Figma `scopes` Array |
| :--- | :--- |
| `colors/*`, `pixels/*`, `fonts/*`, `opacity/*` (Primitives) | `[]` (**none** — hidden from property pickers) |
| `surface/*`, `theme/*` (color), `tag/*/background` | `['FRAME_FILL', 'SHAPE_FILL']` |
| `content/*`, `tag/*/content` | `['TEXT_FILL', 'SHAPE_FILL']` |
| `outline/*` | `['STROKE_COLOR']` |
| `layout/spacing/*` | `['GAP', 'WIDTH_HEIGHT']` |
| `layout/corner/*`, `theme/corner/*` | `['CORNER_RADIUS']` |
| `theme/size/*`, `layout/breakpoint/*` | `['WIDTH_HEIGHT']` |
| `theme/opacity/*` | `['OPACITY']` |

---

## 4. Component, Variant, and Layer Rules

- **Component Names**: Singular noun in Title Case ASCII (`Button`, `Meeting Row`, `Bottom Nav`, `Lists/Thread Row`). Never plural (`Buttons`).
- **Variant Properties**: Title Case nouns with separate axes:
  - `Type` / `Tone`: what it is (`Type=Primary`, `Tone=Rose`)
  - `Size`: how big (`Size=Default`, `Size=Compact`)
  - `State`: lifecycle/interaction (`Default`, `Hover`, `Pressed`, `Focused`, `Selected`, `Disabled`, `Loading`, `Error`). Never put `Disabled` under `Type`.
- **1:1 Code Mapping**:
  - `State=Disabled` $\rightarrow$ `enabled = false`
  - `State=Loading` $\rightarrow$ `loading = true`
  - Boolean properties use `Has ...` or `Show ...` (`Has Leading Icon`).
- **Layer Names**: Role-based lower-case kebab-case ASCII (`container`, `label`, `leading-icon`, `trailing-icon`, `badge`, `avatar`, `title`, `subtitle`, `meta`, `divider`). Private building blocks start with `_`.
- **Screen Frame Names**: `{Screen} / {State}` in Title Case ASCII (`Home / Default`, `Meetings / Empty`, `Post / Desktop`).
