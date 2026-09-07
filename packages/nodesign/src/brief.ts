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

export function formatAgentDirective(screenName = "Target UI"): string {
  return [
    "================================================================================",
    "STRICT AI AGENT DIRECTIVE — ZERO-DRIFT UI IMPLEMENTATION CONTRACT",
    "================================================================================",
    `You are implementing '${screenName}' based on extracted design evidence.`,
    "Follow these 4 non-negotiable rules:",
    "",
    "1. MANDATORY BLUEPRINT ADHERENCE:",
    "   - Build the exact component tree structure specified in the UI Blueprint below.",
    "   - Do NOT alter container ordering, layout direction (ROW/COLUMN), or node nesting.",
    "",
    "2. REUSE DISCOVERED COMPONENTS & THEME TOKENS:",
    "   - MUST reuse discovered project components (e.g. `Header()`, `PrimaryButton()`) wherever mapped.",
    "   - MUST use discovered theme variables (e.g. `TapatColors.brandPrimary` or `PrimaryBlue`) instead of raw hex values.",
    "   - Do NOT invent duplicate components or hardcode raw Color(0xFF...) when theme tokens exist.",
    "",
    "3. ZERO DRIFT GUARANTEE:",
    "   - Do NOT add unrequested cards, extra wrappers, or random decorative elements.",
    "   - Match all specified padding, spacing/gap, fonts, and dimensions 1:1.",
    "",
    "4. CODE INTEGRITY:",
    "   - Ensure the generated code compiles cleanly with all required package imports.",
    "================================================================================",
  ].join("\n");
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

/** Format a PreflightResult as a DesignBrief in JSON, human-readable text, or Markdown. */
export function formatDesignBrief(
  taskId: string,
  preflight: PreflightResult,
  format: "json" | "human" | "markdown" = "human",
): string {
  const brief: DesignBrief = {
    taskId,
    timestamp: new Date().toISOString(),
    preflight,
  };

  if (format === "json") {
    return JSON.stringify(brief, null, 2);
  }

  if (format === "markdown") {
    const mdLines: string[] = [
      `# Design Brief: \`${brief.taskId}\``,
      `*Generated: ${brief.timestamp}*`,
      "",
      `| Parameter | Value |`,
      `| --- | --- |`,
      `| UI Sensitive | ${preflight.uiSensitive ? "Yes" : "No"} |`,
      `| Android UI Stack | \`${preflight.androidUIStack}\` |`,
      `| Evidence Status | \`${preflight.evidenceStatus}\` |`,
      "",
    ];

    if (preflight.designLinks.length > 0) {
      mdLines.push("## Design Links");
      for (const link of preflight.designLinks) {
        mdLines.push(`- **[${link.provider}]** [${link.url}](${link.url})${link.label ? ` (*${link.label}*)` : ""}`);
      }
      mdLines.push("");
    }

    if (preflight.resolvedScreens?.length) {
      mdLines.push("## Resolved Zeplin Screens");
      for (const s of preflight.resolvedScreens) {
        mdLines.push(`### ${s.name || s.screenId || "Screen"} (\`${s.status}\`)`);
        if (s.extract?.hierarchy?.length) {
          mdLines.push("```text");
          mdLines.push(...formatTreeBlueprint(s.extract.hierarchy, 0));
          mdLines.push("```");
        }
      }
      mdLines.push("");
    }

    if (preflight.resolvedFigma?.length) {
      mdLines.push("## Resolved Figma Links");
      for (const f of preflight.resolvedFigma) {
        mdLines.push(`### ${f.name || f.fileKey || "Figma Frame"} (\`${f.status}\`)`);
        if (f.extract?.hierarchy?.length) {
          mdLines.push("```text");
          mdLines.push(...formatTreeBlueprint(f.extract.hierarchy, 0));
          mdLines.push("```");
        }
      }
      mdLines.push("");
    }

    return mdLines.join("\n");
  }

  const lines: string[] = [
    `Design Brief: ${brief.taskId}`,
    `Timestamp: ${brief.timestamp}`,
    "",
    `UI Sensitive: ${preflight.uiSensitive ? "yes" : "no"}`,
    `Android UI Stack: ${preflight.androidUIStack}`,
    `Architecture Structure: ${preflight.architectureType || "AD_HOC"}`,
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
      if (screen.extract?.hierarchy?.length) {
        lines.push("    hierarchy:");
        for (const line of formatTreeBlueprint(screen.extract.hierarchy, 3)) {
          lines.push(`    ${line}`);
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
      if (fig.extract?.hierarchy?.length) {
        lines.push("    hierarchy:");
        for (const line of formatTreeBlueprint(fig.extract.hierarchy, 3)) {
          lines.push(`    ${line}`);
        }
      }
      if (fig.note) lines.push(`    note=${fig.note}`);
    }
  }

  if ((preflight.components?.length ?? 0) > 0) {
    lines.push("", "UI Components:");
    for (const component of preflight.components ?? []) {
      const usageInfo = component.sampleUsage ? ` sample="${component.sampleUsage}"` : "";
      lines.push(`  - ${component.name} (${component.path})${usageInfo}`);
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
