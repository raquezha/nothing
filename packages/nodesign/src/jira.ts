import { execSync } from "node:child_process";
import type { DesignLink } from "./types.js";
import { parseDesignLink } from "./brief.js";

const ZEPLIN_URL_REGEX = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:zpl\.io|zeplin\.io)\/[^\s"'>]+/gi;
const FIGMA_URL_REGEX = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?figma\.com\/[^\s"'>]+/gi;

export interface JiraInspectionResult {
  designLinks: DesignLink[];
  notes: string[];
}

export function extractDesignLinksFromText(text: string): DesignLink[] {
  const links: DesignLink[] = [];
  const matches = [
    ...(text.match(ZEPLIN_URL_REGEX) || []),
    ...(text.match(FIGMA_URL_REGEX) || []),
  ];

  const seen = new Set<string>();
  for (const rawUrl of matches) {
    const cleanUrl = rawUrl.replace(/[.,;)]+$/, "");
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);
    links.push(parseDesignLink(cleanUrl).link);
  }

  return links;
}

export function inspectJiraTaskText(text: string): JiraInspectionResult {
  const designLinks = extractDesignLinksFromText(text);
  const notes: string[] = [];

  // Parse structured Jira JSON if present to extract attachments and nested URL values
  try {
    if (text.trim().startsWith("{")) {
      const data = JSON.parse(text);
      const attachments = data?.fields?.attachment || data?.attachments || [];
      if (Array.isArray(attachments)) {
        for (const att of attachments) {
          const url = att.content || att.url || att.self;
          const filename = att.filename || att.name || "Attachment";
          if (url && !designLinks.some((l) => l.url === url)) {
            designLinks.push({
              provider: "other",
              url,
              label: `Attachment: ${filename}`,
            });
          }
        }
      }

      // Scan nested string values in JSON for any direct Figma or Zeplin URLs that regex on raw text might miss
      const scanObject = (obj: unknown, depth = 0): void => {
        if (depth > 6 || !obj) return;
        if (typeof obj === "string") {
          const nestedLinks = extractDesignLinksFromText(obj);
          for (const nl of nestedLinks) {
            if (!designLinks.some((l) => l.url === nl.url)) {
              designLinks.push(nl);
            }
          }
          return;
        }
        if (Array.isArray(obj)) {
          for (const item of obj) scanObject(item, depth + 1);
          return;
        }
        if (typeof obj === "object") {
          for (const key of Object.keys(obj as Record<string, unknown>)) {
            scanObject((obj as Record<string, unknown>)[key], depth + 1);
          }
        }
      };

      scanObject(data);
    }
  } catch {
    // Ignore JSON parse errors for non-JSON raw text
  }

  if (designLinks.length === 0) {
    notes.push("No direct Zeplin, Figma, or attachment design links found in Jira text");
  } else {
    notes.push(`Discovered ${designLinks.length} design link(s) in Jira text`);
  }

  return { designLinks, notes };
}

export function inspectJiraContext(issueId: string): JiraInspectionResult {
  if (!issueId || issueId === "unknown") {
    return { designLinks: [], notes: ["No Jira issue ID provided"] };
  }

  // 1. Attempt `jira issue view <id> --raw`
  try {
    const rawText = execSync(`jira issue view "${issueId.replace(/"/g, "")}" --raw`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return inspectJiraTaskText(rawText);
  } catch {
    // Fallback: try `acli`
    try {
      const acliText = execSync(`acli jira workitem view "${issueId.replace(/"/g, "")}" --json`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return inspectJiraTaskText(acliText);
    } catch {
      return {
        designLinks: [],
        notes: [`Jira CLI (jira / acli) unavailable for issue ${issueId}`],
      };
    }
  }
}
