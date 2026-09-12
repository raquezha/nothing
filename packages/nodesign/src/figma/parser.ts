import type {
  FigmaColorSpec,
  FigmaTypographySpec,
  FigmaLayoutSpec,
  FigmaNodeSpec,
  FigmaExtractSpec,
} from "./types.js";

export function toByte(value: number | undefined): number {
  return Math.min(255, Math.max(0, Math.round((value ?? 0) * 255)));
}

export function rgbaToHex(color: any): string {
  const r = toByte(color?.r);
  const g = toByte(color?.g);
  const b = toByte(color?.b);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
}

export function colorFromPaint(paint: any): FigmaColorSpec | undefined {
  if (!paint || paint.visible === false || !paint.color) return undefined;
  const alpha = (paint.color.a ?? 1) * (paint.opacity ?? 1);
  return {
    hex: rgbaToHex(paint.color),
    opacity: alpha,
  };
}

export function collectColors(node: any, out: FigmaColorSpec[], seen: Set<string>): void {
  if (!node || typeof node !== "object") return;
  for (const paint of [...(node.fills || []), ...(node.strokes || [])]) {
    const spec = colorFromPaint(paint);
    if (!spec) continue;
    const key = `${spec.hex}:${spec.opacity ?? 1}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(spec);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectColors(child, out, seen);
  }
}

export function collectTypography(node: any, out: FigmaTypographySpec[]): void {
  if (!node || typeof node !== "object") return;
  if (node.style?.fontFamily || node.style?.fontSize || node.style?.fontWeight) {
    const fill = Array.isArray(node.fills) ? colorFromPaint(node.fills[0]) : undefined;
    out.push({
      text: typeof node.characters === "string" ? node.characters : undefined,
      fontFamily: node.style.fontFamily,
      fontWeight: node.style.fontWeight,
      fontSize: node.style.fontSize,
      lineHeight: node.style.lineHeightPx,
      color: fill?.hex,
    });
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectTypography(child, out);
  }
}

export function extractLayout(node: any): FigmaLayoutSpec {
  const box = node?.absoluteBoundingBox || {};
  return {
    width: box.width,
    height: box.height,
    x: box.x,
    y: box.y,
    direction: node?.layoutMode,
    gap: node?.itemSpacing,
    padding: {
      top: node?.paddingTop,
      right: node?.paddingRight,
      bottom: node?.paddingBottom,
      left: node?.paddingLeft,
    },
  };
}

export function toHierarchy(node: any): FigmaNodeSpec | undefined {
  if (!node?.name) return undefined;
  if (node.visible === false || node.opacity === 0) return undefined;

  const children = Array.isArray(node.children)
    ? node.children.map(toHierarchy).filter(Boolean) as FigmaNodeSpec[]
    : undefined;

  const fill = Array.isArray(node.fills) ? colorFromPaint(node.fills[0]) : undefined;
  const font = node.style ? {
    fontFamily: node.style.fontFamily,
    fontSize: node.style.fontSize,
    fontWeight: node.style.fontWeight,
  } : undefined;
  const layout = extractLayout(node);
  const text = typeof node.characters === "string" ? node.characters : undefined;
  const variant = node.variantProperties ? Object.entries(node.variantProperties).map(([k, v]) => `${k}=${v}`).join(", ") : undefined;

  return {
    name: node.name,
    type: node.type,
    ...(text ? { text } : {}),
    ...(fill?.hex ? { color: fill.hex } : {}),
    ...(font?.fontFamily || font?.fontSize ? { font } : {}),
    ...(layout.width || layout.height || layout.direction ? { layout } : {}),
    ...(variant ? { variant } : {}),
    ...(children && children.length ? { children } : {}),
  };
}

export function extractDetails(node: any): FigmaExtractSpec {
  const colors: FigmaColorSpec[] = [];
  collectColors(node, colors, new Set());
  const typography: FigmaTypographySpec[] = [];
  collectTypography(node, typography);
  return {
    colors,
    typography,
    layout: extractLayout(node),
    hierarchy: (node?.children || []).map(toHierarchy).filter(Boolean) as FigmaNodeSpec[],
  };
}
