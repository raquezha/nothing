import type { DesignBrief, DesignLink, EvidenceStatus, PreflightResult } from "./types.js";

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

/** Determine overall evidence status from a list of links and UI sensitivity. */
export function determineEvidenceStatus(links: DesignLink[], uiSensitive: boolean): EvidenceStatus {
  if (!uiSensitive) return "ready";
  if (links.length === 0) return "missing";
  const statuses = links.map((link) => parseDesignLink(link.url).status);
  if (statuses.includes("ready")) return "ready";
  if (statuses.includes("ambiguous")) return "ambiguous";
  return "missing";
}

/** Format a PreflightResult as a DesignBrief in JSON or human-readable text. */
export function formatDesignBrief(
  taskId: string,
  preflight: PreflightResult,
  format: "json" | "human" = "human",
): string {
  const brief: DesignBrief = {
    taskId,
    timestamp: new Date().toISOString(),
    preflight,
  };

  if (format === "json") {
    return JSON.stringify(brief, null, 2);
  }

  const lines: string[] = [
    `Design Brief: ${brief.taskId}`,
    `Timestamp: ${brief.timestamp}`,
    "",
    `UI Sensitive: ${preflight.uiSensitive ? "yes" : "no"}`,
    `Android UI Stack: ${preflight.androidUIStack}`,
    `Evidence Status: ${preflight.evidenceStatus}`,
  ];

  if (preflight.designLinks.length > 0) {
    lines.push("", "Design Links:");
    for (const link of preflight.designLinks) {
      lines.push(`  - [${link.provider}] ${link.url}${link.label ? ` (${link.label})` : ""}`);
    }
  }

  if (preflight.resolvedScreens?.length) {
    lines.push("", "Resolved Screens:");
    for (const screen of preflight.resolvedScreens) {
      lines.push(`  - status=${screen.status}`);
      if (screen.screen) {
        lines.push(`    name=${screen.screen.name} id=${screen.screen.id} ${screen.screen.width}x${screen.screen.height}`);
        if (screen.screen.colors.length) {
          lines.push(`    colors=${screen.screen.colors.map((color) => color.hex).join(", ")}`);
        }
        if (screen.screen.layerNames.length) {
          lines.push(`    layers=${screen.screen.layerNames.join(", ")}`);
        }
      }
      if (screen.savedAssets?.length) {
        lines.push(`    savedAssets=${screen.savedAssets.join(", ")}`);
      }
      if (screen.note) {
        lines.push(`    note=${screen.note}`);
      }
    }
  }

  if (preflight.resolvedFigma?.length) {
    lines.push("", "Resolved Figma Links:");
    for (const fig of preflight.resolvedFigma) {
      lines.push(`  - status=${fig.status} url=${fig.url}`);
      if (fig.fileKey) lines.push(`    fileKey=${fig.fileKey}${fig.nodeId ? ` nodeId=${fig.nodeId}` : ""}`);
      if (fig.name) lines.push(`    name=${fig.name}`);
      if (fig.note) lines.push(`    note=${fig.note}`);
    }
  }

  if ((preflight.components?.length ?? 0) > 0) {
    lines.push("", "UI Components:");
    for (const component of preflight.components ?? []) {
      lines.push(`  - ${component.name} (${component.path})`);
    }
  }

  if (preflight.notes.length > 0) {
    lines.push("", "Notes:");
    for (const note of preflight.notes) {
      lines.push(`  - ${note}`);
    }
  }

  return lines.join("\n");
}
