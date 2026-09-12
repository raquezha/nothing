import type {
  ZeplinColorSpec,
  ZeplinTypographySpec,
  ZeplinLayoutSpec,
  ZeplinNodeSpec,
  ZeplinScreenSpec,
  ZeplinExtractSpec,
} from "./types.js";

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function toColorSpec(color: any): ZeplinColorSpec | undefined {
  if (!color || typeof color !== "object") return undefined;
  const r = color.r ?? color.red ?? 0;
  const g = color.g ?? color.green ?? 0;
  const b = color.b ?? color.blue ?? 0;
  const a = color.a ?? color.alpha ?? 1;
  return {
    r,
    g,
    b,
    a,
    hex: color.hex || rgbToHex(r, g, b),
  };
}

export function collectColors(node: any, out: ZeplinColorSpec[], seen: Set<string>): void {
  if (!node || typeof node !== "object") return;
  const colorCandidates = [node.color, node.fill, node.backgroundColor, node.textColor];
  for (const candidate of colorCandidates) {
    const spec = toColorSpec(candidate);
    if (!spec) continue;
    const key = `${spec.hex}:${spec.a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(spec);
  }
  if (Array.isArray(node.colors)) {
    for (const color of node.colors) {
      const spec = toColorSpec(color);
      if (!spec) continue;
      const key = `${spec.hex}:${spec.a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(spec);
    }
  }
  if (Array.isArray(node.layers)) {
    for (const layer of node.layers) collectColors(layer, out, seen);
  }
}

export function collectTypography(node: any, out: ZeplinTypographySpec[]): void {
  if (!node || typeof node !== "object") return;
  const style = node.textStyles?.[0] || node.defaultTextStyle || node.style || {};
  if (node.type === "text" || style.fontFamily || style.fontSize || style.lineHeight) {
    const color = toColorSpec(style.color || node.color);
    out.push({
      text: typeof node.content === "string" ? node.content : typeof node.name === "string" ? node.name : undefined,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      color: color?.hex,
    });
  }
  if (Array.isArray(node.layers)) {
    for (const layer of node.layers) collectTypography(layer, out);
  }
}

export function toHierarchy(node: any): ZeplinNodeSpec | undefined {
  if (!node || typeof node !== "object") return undefined;
  if (node.visible === false || node.hidden === true || node.opacity === 0) return undefined;

  const children = Array.isArray(node.layers)
    ? node.layers.map(toHierarchy).filter(Boolean) as ZeplinNodeSpec[]
    : undefined;

  const name = typeof node.name === "string" && node.name ? node.name : typeof node.id === "string" ? node.id : undefined;
  if (!name) return undefined;

  const style = node.textStyles || node.style || {};
  const colorSpec = toColorSpec(node.color || node.fill || style.color);
  const font = (style.fontFamily || style.fontSize) ? {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
  } : undefined;
  const layout = extractLayout(node);
  const text = typeof node.content === "string" ? node.content : undefined;

  return {
    name,
    type: typeof node.type === "string" ? node.type : undefined,
    ...(text ? { text } : {}),
    ...(colorSpec?.hex ? { color: colorSpec.hex } : {}),
    ...(font ? { font } : {}),
    ...(layout.width || layout.height || layout.direction ? { layout } : {}),
    ...(children && children.length ? { children } : {}),
  };
}

export function extractLayout(data: any): ZeplinLayoutSpec {
  const rect = data?.rect || data?.bounds || {};
  return {
    width: data?.width ?? rect.width,
    height: data?.height ?? rect.height,
    x: rect.x,
    y: rect.y,
    direction: data?.layout?.direction || data?.flexDirection,
    gap: data?.layout?.gap ?? data?.itemSpacing,
    padding: data?.layout?.padding || data?.padding,
  };
}

export function extractScreen(data: any, fallbackId: string): ZeplinScreenSpec {
  const colors = (data.colors || []).map(toColorSpec).filter(Boolean) as ZeplinColorSpec[];
  return {
    id: data.id || fallbackId,
    name: data.name || "Untitled Screen",
    width: data.width || 0,
    height: data.height || 0,
    colors,
    layerNames: (data.layers || []).map((l: any) => l.name).filter(Boolean),
  };
}

export function extractDetails(data: any, screen: ZeplinScreenSpec): ZeplinExtractSpec {
  const colors = [...screen.colors];
  const seen = new Set(colors.map((c) => `${c.hex}:${c.a}`));
  collectColors(data, colors, seen);
  const typography: ZeplinTypographySpec[] = [];
  collectTypography(data, typography);
  return {
    colors,
    typography,
    layout: extractLayout(data),
    hierarchy: (data.layers || []).map(toHierarchy).filter(Boolean) as ZeplinNodeSpec[],
  };
}
