import type { ArchitectureType, ComponentFact } from "./types.js";
import type { ColorTokenFact } from "./android.js";
import type { FigmaNodeSpec } from "./figma.js";
import type { ZeplinNodeSpec } from "./zeplin.js";

type UnifiedNode = FigmaNodeSpec | ZeplinNodeSpec;

export interface ProjectCodeContext {
  components?: ComponentFact[];
  colorTokens?: ColorTokenFact[];
  architectureType?: ArchitectureType;
}


function toComposeColor(hex?: string, colorTokens?: ColorTokenFact[]): string {
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
    // Convert #RRGGBBAA (CSS) to 0xAARRGGBB (Jetpack Compose)
    clean = `${clean.slice(6, 8)}${clean.slice(0, 6)}`;
  }
  return `Color(0x${clean})`;
}



function escapeString(val: string): string {
  return val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function toFontWeight(weight?: number | string): string | undefined {
  if (!weight) return undefined;
  if (weight === 700 || weight === "700" || weight === "bold" || weight === "BOLD") return "FontWeight.Bold";
  if (weight === 600 || weight === "600" || weight === "semibold" || weight === "SEMIBOLD") return "FontWeight.SemiBold";
  if (weight === 500 || weight === "500" || weight === "medium" || weight === "MEDIUM") return "FontWeight.Medium";
  if (weight === 400 || weight === "400" || weight === "normal" || weight === "REGULAR") return "FontWeight.Normal";
  if (weight === 300 || weight === "300" || weight === "light" || weight === "LIGHT") return "FontWeight.Light";
  if (typeof weight === "number") return `FontWeight(${weight})`;
  return undefined;
}

function formatComposePadding(padStr: string, padding?: { top?: number; right?: number; bottom?: number; left?: number }): string {
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

function nodeToCompose(node: UnifiedNode, indent = 1, context?: ProjectCodeContext, rootScreenName?: string): string {
  const pad = "    ".repeat(indent);
  const name = node.name.replace(/[^a-zA-Z0-9]/g, "") || "Element";
  const children: UnifiedNode[] = Array.isArray(node.children) ? node.children : [];

  if (context?.components && context.components.length > 0) {
    const matchedComp = context.components.find(
      (c) => (c.name.toLowerCase() === name.toLowerCase() || c.name.toLowerCase() === node.name.toLowerCase()) && c.name.toLowerCase() !== rootScreenName?.toLowerCase(),
    );
    if (matchedComp) {
      return `${pad}// Reusing discovered component: ${matchedComp.path}\n${pad}${matchedComp.name}()`;
    }
  }

  if (node.text) {
    const fontSize = node.font?.fontSize ? `${node.font.fontSize}.sp` : "TextUnit.Unspecified";
    const fontWeight = toFontWeight(node.font?.fontWeight);
    const color = toComposeColor(node.color, context?.colorTokens);
    const weightLine = fontWeight ? `,\n${pad}    fontWeight = ${fontWeight}` : "";
    return `${pad}// ${name}\n${pad}Text(\n${pad}    text = "${escapeString(node.text)}",\n${pad}    fontSize = ${fontSize}${weightLine},\n${pad}    color = ${color}\n${pad})`;
  }

  const isRow = node.layout?.direction === "ROW" || node.layout?.direction === "HORIZONTAL";
  const container = isRow ? "Row" : "Column";
  const bg = node.color ? `\n${pad}        .background(${toComposeColor(node.color, context?.colorTokens)})` : "";
  const size = node.layout?.width && node.layout?.height
    ? `\n${pad}        .size(${node.layout.width}.dp, ${node.layout.height}.dp)`
    : "";
  const paddingMod = formatComposePadding(pad, node.layout?.padding);
  const gapArrangement = node.layout?.gap
    ? (isRow ? `,\n${pad}    horizontalArrangement = Arrangement.spacedBy(${node.layout.gap}.dp)` : `,\n${pad}    verticalArrangement = Arrangement.spacedBy(${node.layout.gap}.dp)`)
    : "";

  const inner = children.map((c: UnifiedNode) => nodeToCompose(c, indent + 1, context, rootScreenName)).join("\n");
  return `${pad}// ${name}\n${pad}${container}(\n${pad}    modifier = Modifier${size}${bg}${paddingMod}${gapArrangement}\n${pad}) {\n${inner ? `${inner}\n` : ""}${pad}}`;
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
  context?: ProjectCodeContext,
): string {
  if (!nodes || nodes.length === 0) return "// No hierarchy nodes available for code generation";

  let cleanName = screenName.replace(/[^a-zA-Z0-9]/g, "");
  if (!cleanName || /^[0-9]/.test(cleanName)) {
    cleanName = `Screen${cleanName}`;
  }

  switch (target) {
    case "compose": {
      const baseImports = [

        "import androidx.compose.foundation.background",
        "import androidx.compose.foundation.layout.*",
        "import androidx.compose.material3.Text",
        "import androidx.compose.runtime.Composable",
        "import androidx.compose.ui.Alignment",
        "import androidx.compose.ui.Modifier",
        "import androidx.compose.ui.graphics.Color",
        "import androidx.compose.ui.text.font.FontWeight",
        "import androidx.compose.ui.unit.dp",
        "import androidx.compose.ui.unit.sp",
      ];

      const customImports = new Set<string>();
      if (context?.colorTokens) {
        for (const ct of context.colorTokens) {
          if (ct.importStatement) customImports.add(ct.importStatement);
        }
      }

      const allImports = [...baseImports, ...Array.from(customImports)].sort().join("\n");
      const archHeader = context?.architectureType
        ? `// Architecture Structure: ${context.architectureType}\n`
        : "";
      const body = nodes.map((n) => nodeToCompose(n, 1, context, cleanName)).join("\n\n");
      return `${archHeader}${allImports}\n\n@Composable\nfun ${cleanName}() {\n${body}\n}`;
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

