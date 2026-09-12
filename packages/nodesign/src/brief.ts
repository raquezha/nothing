import type { DesignLink, EvidenceStatus, ArchitectureType, AndroidUIStack } from "./types.js";
import { buildStackAwareDirective } from "./stack/directive.js";

export { formatDesignBrief } from "./briefFormatter.js";

/** Parse a raw design link URL into a structured DesignLink and EvidenceStatus. */
export function parseDesignLink(rawUrl: string): { link: DesignLink; status: EvidenceStatus; note?: string } {
  const url = rawUrl.trim().replace(/[.,;)]+$/, "");
  if (url.includes("figma.com")) {
    const hasNodeId = url.includes("node-id=") || url.includes("node_id=");
    return {
      link: { provider: "figma", url, label: hasNodeId ? "Figma frame" : "Figma file/canvas" },
      status: hasNodeId ? "ready" : "ambiguous",
      note: hasNodeId ? undefined : "Figma URL missing node-id parameter for direct layout truth",
    };
  }

  if (url.startsWith("zpl://") || url.includes("zpl.io") || url.includes("zeplin.io")) {
    return {
      link: { provider: "zeplin", url, label: "Zeplin screen" },
      status: "ready",
    };
  }

  return {
    link: { provider: "other", url, label: "Design attachment" },
    status: "ambiguous",
    note: "Attachment or unparsed URL treated as ambiguous design evidence",
  };
}

export function formatAgentDirective(
  screenName = "Target UI",
  architectureType: ArchitectureType = "CLEAN_ARCHITECTURE",
  archDetails = "Konsist-style code pattern scanner",
  stack: AndroidUIStack = "compose",
): string {
  return buildStackAwareDirective(screenName, stack, architectureType, archDetails);
}

export function formatTreeBlueprint(nodes: any[], indent = 0): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    const prefix = "  ".repeat(indent) + (indent > 0 ? "├── " : "");
    const typeStr = node.type ? `[${node.type}] ` : "";
    const nameStr = node.name || "node";

    const props: string[] = [];
    if (node.text) props.push(`text="${node.text}"`);
    if (node.layout) {
      if (node.layout.width || node.layout.height) props.push(`${node.layout.width || "?"}x${node.layout.height || "?"}`);
      if (node.layout.direction) props.push(node.layout.direction);
      if (node.layout.gap) props.push(`gap=${node.layout.gap}`);
    }
    if (node.font) {
      if (node.font.fontFamily) props.push(node.font.fontFamily);
      if (node.font.fontSize) props.push(`${node.font.fontSize}px`);
      if (node.font.fontWeight) props.push(`w${node.font.fontWeight}`);
    }
    if (node.color) props.push(`color=${node.color}`);

    const propStr = props.length ? ` (${props.join(", ")})` : "";
    lines.push(`${prefix}${typeStr}${nameStr}${propStr}`);

    if (Array.isArray(node.children) && node.children.length > 0) {
      lines.push(...formatTreeBlueprint(node.children, indent + 1));
    }
  }
  return lines;
}

/** Determine overall evidence status from a list of links and UI sensitivity. */
export function determineEvidenceStatus(links: DesignLink[], uiSensitive: boolean): EvidenceStatus {
  if (!uiSensitive) return "ready";
  if (links.length === 0) return "missing";
  const statuses = links.map((link) => parseDesignLink(link.url).status);
  if (statuses.includes("ready")) return "ready";
  if (statuses.includes("ambiguous")) return "ambiguous";
  return "missing";
}
