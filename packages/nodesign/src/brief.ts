import type { PreflightResult, DesignBrief } from "./types.js";

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

  if (preflight.notes.length > 0) {
    lines.push("", "Notes:");
    for (const note of preflight.notes) {
      lines.push(`  - ${note}`);
    }
  }

  return lines.join("\n");
}
