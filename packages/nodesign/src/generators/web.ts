import type { UnifiedNode } from "./compose.js";

function escapeHtml(val: string): string {
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function nodeToReact(node: UnifiedNode, indent = 1): string {
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
    return `${pad}<span className="${fontStyle.trim()}"${colorStyle}>${escapeHtml(node.text)}</span>`;
  }

  const inner = children.map((c: UnifiedNode) => nodeToReact(c, indent + 1)).join("\n");
  return `${pad}<div className="flex ${styles.join(" ")}"${styleAttr}>\n${inner ? `${inner}\n` : ""}${pad}</div>`;
}

export function nodeToHtml(node: UnifiedNode, indent = 1): string {
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
    return `${pad}<span style="${fontStyles.join("; ")}">${escapeHtml(node.text)}</span>`;
  }

  const inner = children.map((c: UnifiedNode) => nodeToHtml(c, indent + 1)).join("\n");
  return `${pad}<div style="${styles.join("; ")}">\n${inner ? `${inner}\n` : ""}${pad}</div>`;
}
