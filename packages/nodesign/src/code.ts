import type { FigmaNodeSpec } from "./figma.js";
import type { ZeplinNodeSpec } from "./zeplin.js";

type UnifiedNode = FigmaNodeSpec | ZeplinNodeSpec;

function toComposeColor(hex?: string): string {
  if (!hex) return "Color.Unspecified";
  let clean = hex.replace("#", "").toUpperCase();
  if (clean.length === 3) {
    clean = `${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`;
  }
  if (clean.length === 6) {
    clean = `FF${clean}`;
  } else if (clean.length === 8) {
    // Convert #RRGGBBAA (CSS) to 0xAARRGGBB (Jetpack Compose)
    clean = `${clean.slice(6, 8)}${clean.slice(0, 6)}`;
  }
  return `Color(0x${clean})`;
}


function escapeString(val: string): string {
  return val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function nodeToCompose(node: UnifiedNode, indent = 1): string {
  const pad = "    ".repeat(indent);
  const name = node.name.replace(/[^a-zA-Z0-9]/g, "") || "Element";
  const children: UnifiedNode[] = Array.isArray(node.children) ? node.children : [];

  if (node.text) {
    const fontSize = node.font?.fontSize ? `${node.font.fontSize}.sp` : "TextUnit.Unspecified";
    const color = toComposeColor(node.color);
    return `${pad}// ${name}\n${pad}Text(\n${pad}    text = "${escapeString(node.text)}",\n${pad}    fontSize = ${fontSize},\n${pad}    color = ${color}\n${pad})`;
  }

  const isRow = node.layout?.direction === "ROW" || node.layout?.direction === "HORIZONTAL";
  const container = isRow ? "Row" : "Column";
  const bg = node.color ? `\n${pad}        .background(${toComposeColor(node.color)})` : "";
  const size = node.layout?.width && node.layout?.height
    ? `\n${pad}        .size(${node.layout.width}.dp, ${node.layout.height}.dp)`
    : "";

  const inner = children.map((c: UnifiedNode) => nodeToCompose(c, indent + 1)).join("\n");
  return `${pad}// ${name}\n${pad}${container}(\n${pad}    modifier = Modifier${size}${bg}\n${pad}) {\n${inner ? `${inner}\n` : ""}${pad}}`;
}


function nodeToReact(node: UnifiedNode, indent = 1): string {
  const pad = "  ".repeat(indent);
  const children: UnifiedNode[] = Array.isArray(node.children) ? node.children : [];
  const isRow = node.layout?.direction === "ROW" || node.layout?.direction === "HORIZONTAL";

  const styles: string[] = [isRow ? "flex-row" : "flex-col"];
  if (node.layout?.gap) styles.push(`gap-[${node.layout.gap}px]`);
  if (node.layout?.width && node.layout?.height) styles.push(`w-[${node.layout.width}px] h-[${node.layout.height}px]`);

  const styleAttr = node.color ? ` style={{ backgroundColor: '${node.color}' }}` : "";

  if (node.text) {
    const fontStyle = node.font?.fontSize ? ` text-[${node.font.fontSize}px]` : "";
    const colorStyle = node.color ? ` style={{ color: '${node.color}' }}` : "";
    return `${pad}<span className="${fontStyle.trim()}"${colorStyle}>${node.text}</span>`;
  }

  const inner = children.map((c: UnifiedNode) => nodeToReact(c, indent + 1)).join("\n");
  return `${pad}<div className="flex ${styles.join(" ")}"${styleAttr}>\n${inner ? `${inner}\n` : ""}${pad}</div>`;
}

function nodeToHtml(node: UnifiedNode, indent = 1): string {
  const pad = "  ".repeat(indent);
  const children: UnifiedNode[] = Array.isArray(node.children) ? node.children : [];
  const isRow = node.layout?.direction === "ROW" || node.layout?.direction === "HORIZONTAL";

  const styles: string[] = [`display: flex`, `flex-direction: ${isRow ? "row" : "column"}`];
  if (node.layout?.gap) styles.push(`gap: ${node.layout.gap}px`);
  if (node.layout?.width) styles.push(`width: ${node.layout.width}px`);
  if (node.layout?.height) styles.push(`height: ${node.layout.height}px`);
  if (node.color) styles.push(`background-color: ${node.color}`);

  if (node.text) {
    const fontStyles: string[] = [];
    if (node.font?.fontFamily) fontStyles.push(`font-family: '${node.font.fontFamily}'`);
    if (node.font?.fontSize) fontStyles.push(`font-size: ${node.font.fontSize}px`);
    if (node.font?.fontWeight) fontStyles.push(`font-weight: ${node.font.fontWeight}`);
    if (node.color) fontStyles.push(`color: ${node.color}`);
    return `${pad}<span style="${fontStyles.join("; ")}">${node.text}</span>`;
  }

  const inner = children.map((c: UnifiedNode) => nodeToHtml(c, indent + 1)).join("\n");
  return `${pad}<div style="${styles.join("; ")}">\n${inner ? `${inner}\n` : ""}${pad}</div>`;
}

export function generateCodeSnippet(
  nodes: UnifiedNode[],
  target: "compose" | "react" | "html",
  screenName = "GeneratedScreen",
): string {
  if (!nodes || nodes.length === 0) return "// No hierarchy nodes available for code generation";

  let cleanName = screenName.replace(/[^a-zA-Z0-9]/g, "");
  if (!cleanName || /^[0-9]/.test(cleanName)) {
    cleanName = `Screen${cleanName}`;
  }

  switch (target) {
    case "compose": {
      const body = nodes.map((n) => nodeToCompose(n, 1)).join("\n\n");
      return `@Composable\nfun ${cleanName}() {\n${body}\n}`;
    }
    case "react": {
      const body = nodes.map((n) => nodeToReact(n, 2)).join("\n\n");
      return `export function ${cleanName}() {\n  return (\n${body}\n  );\n}`;
    }
    case "html": {
      const body = nodes.map((n) => nodeToHtml(n, 1)).join("\n\n");
      return `<!-- Design Spec HTML -->\n<div class="${cleanName.toLowerCase()}">\n${body}\n</div>`;
    }
  }
}

