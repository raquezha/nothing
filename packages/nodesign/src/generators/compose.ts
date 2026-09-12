import type { ColorTokenFact } from "../android.js";
import type { FigmaNodeSpec } from "../figma.js";
import type { ZeplinNodeSpec } from "../zeplin.js";
import { matchComponent } from "../matcher.js";

export type UnifiedNode = FigmaNodeSpec | ZeplinNodeSpec;

export interface ProjectCodeContext {
  components?: import("../types.js").ComponentFact[];
  colorTokens?: ColorTokenFact[];
  architectureType?: import("../types.js").ArchitectureType;
  androidUIStack?: import("../types.js").AndroidUIStack;
}

export function toComposeColor(hex?: string, colorTokens?: ColorTokenFact[]): string {
  if (!hex) return "Color.Unspecified";
  const cleanHex = hex.trim().toUpperCase();

  if (colorTokens && colorTokens.length > 0) {
    const matchedToken = colorTokens.find((ct) => ct.hex.toUpperCase() === cleanHex);
    if (matchedToken) return matchedToken.token;
  }

  let clean = cleanHex.replace("#", "");
  if (clean.length === 3) {
    clean = `${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`;
  }
  if (clean.length === 6) {
    clean = `FF${clean}`;
  } else if (clean.length === 8) {
    clean = `${clean.slice(6, 8)}${clean.slice(0, 6)}`;
  }
  return `Color(0x${clean})`;
}

export function toFontWeight(weight?: number | string): string | undefined {
  if (!weight) return undefined;
  if (weight === 700 || weight === "700" || weight === "bold" || weight === "BOLD") return "FontWeight.Bold";
  if (weight === 600 || weight === "600" || weight === "semibold" || weight === "SEMIBOLD") return "FontWeight.SemiBold";
  if (weight === 500 || weight === "500" || weight === "medium" || weight === "MEDIUM") return "FontWeight.Medium";
  if (weight === 400 || weight === "400" || weight === "normal" || weight === "REGULAR") return "FontWeight.Normal";
  if (weight === 300 || weight === "300" || weight === "light" || weight === "LIGHT") return "FontWeight.Light";
  if (typeof weight === "number") return `FontWeight(${weight})`;
  return undefined;
}

export function formatComposePadding(padStr: string, padding?: { top?: number; right?: number; bottom?: number; left?: number }): string {
  if (!padding) return "";
  const { top = 0, right = 0, bottom = 0, left = 0 } = padding;
  if (top === 0 && right === 0 && bottom === 0 && left === 0) return "";
  if (top === bottom && left === right && top === left) {
    return `\n${padStr}        .padding(${top}.dp)`;
  }
  if (top === bottom && left === right) {
    return `\n${padStr}        .padding(horizontal = ${left}.dp, vertical = ${top}.dp)`;
  }
  return `\n${padStr}        .padding(start = ${left}.dp, top = ${top}.dp, end = ${right}.dp, bottom = ${bottom}.dp)`;
}

export function escapeString(val: string): string {
  return val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export function nodeToCompose(node: UnifiedNode, indent = 1, context?: ProjectCodeContext, rootScreenName?: string): string {
  const pad = "    ".repeat(indent);
  const name = node.name.replace(/[^a-zA-Z0-9]/g, "") || "Element";
  const children: UnifiedNode[] = Array.isArray(node.children) ? node.children : [];

  if (context?.components && context.components.length > 0) {
    const match = matchComponent(node.name, context.components, rootScreenName);
    if (match.matched && match.component) {
      const comp = match.component;
      const sample = comp.sampleUsage ? ` // Sample: ${comp.sampleUsage}` : "";
      return `${pad}// Reusing discovered component: ${comp.path}${sample}\n${pad}${comp.name}()`;
    }
  }

  if (node.text) {
    const fontSizeLine = node.font?.fontSize ? `,\n${pad}    fontSize = ${node.font.fontSize}.sp` : "";
    const fontWeight = toFontWeight(node.font?.fontWeight);
    const color = toComposeColor(node.color, context?.colorTokens);
    const weightLine = fontWeight ? `,\n${pad}    fontWeight = ${fontWeight}` : "";
    return `${pad}// ${name}\n${pad}Text(\n${pad}    text = "${escapeString(node.text)}"${fontSizeLine}${weightLine},\n${pad}    color = ${color}\n${pad})`;
  }

  const isRow = node.layout?.direction === "ROW" || node.layout?.direction === "HORIZONTAL";
  const container = isRow ? "Row" : "Column";
  const bg = node.color ? `\n${pad}        .background(${toComposeColor(node.color, context?.colorTokens)})` : "";
  const isFullWidth = node.layout?.width && (node.layout.width >= 350 || node.layout.width === 360 || node.layout.width === 390 || node.layout.width === 412);
  const sizeModifier = isFullWidth
    ? `\n${pad}        .fillMaxWidth()`
    : node.layout?.width && node.layout?.height
    ? `\n${pad}        .size(${node.layout.width}.dp, ${node.layout.height}.dp)`
    : "";

  const paddingMod = formatComposePadding(pad, node.layout?.padding);
  const gapArrangement = node.layout?.gap
    ? (isRow ? `,\n${pad}    horizontalArrangement = Arrangement.spacedBy(${node.layout.gap}.dp)` : `,\n${pad}    verticalArrangement = Arrangement.spacedBy(${node.layout.gap}.dp)`)
    : "";

  const inner = children.map((c: UnifiedNode) => nodeToCompose(c, indent + 1, context, rootScreenName)).join("\n");
  return `${pad}// ${name}\n${pad}${container}(\n${pad}    modifier = Modifier${sizeModifier}${bg}${paddingMod}${gapArrangement}\n${pad}) {\n${inner ? `${inner}\n` : ""}${pad}}`;
}
