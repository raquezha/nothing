import type { DesignBrief, PreflightResult } from "./types.js";
import { formatTreeBlueprint } from "./brief.js";

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
          lines.push(`    colors=${screen.screen.colors.map((color: any) => color.hex).join(", ")}`);
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
