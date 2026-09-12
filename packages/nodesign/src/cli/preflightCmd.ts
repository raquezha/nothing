import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import type { ParsedArgs } from "./args.js";
import type { DesignLink, PreflightResult } from "../types.js";
import { parseDesignLink, formatDesignBrief, determineEvidenceStatus } from "../brief.js";
import { inspectAndroidProject } from "../android.js";
import { inspectJiraContext, inspectJiraTaskText, extractDesignLinksFromText } from "../jira.js";
import { findWorkflowTaskPath, resolveZeplinLinks, resolveFigmaLinks } from "./resolvers.js";

export async function handlePreflightCommand(args: ParsedArgs, fetchFn: typeof fetch): Promise<void> {
  const inspection = inspectAndroidProject(args.path);
  const designLinks: DesignLink[] = [];
  const notes = [...inspection.notes];

  if (args.url) {
    const parsed = parseDesignLink(args.url);
    designLinks.push(parsed.link);
    if (parsed.note) notes.push(parsed.note);
  }

  if (args.task && args.task !== "unknown") {
    const jiraKey = args.task.startsWith("jira:")
      ? args.task.slice(5)
      : /^[A-Z0-9]+-[0-9]+$/i.test(args.task)
      ? args.task
      : undefined;

    if (jiraKey) {
      const jiraResult = inspectJiraContext(jiraKey);
      for (const link of jiraResult.designLinks) {
        if (!designLinks.some((l) => l.url === link.url)) {
          designLinks.push(link);
        }
      }
      notes.push(...jiraResult.notes);
    }
  }

  const taskPath = findWorkflowTaskPath(args.path);
  if (taskPath && existsSync(taskPath)) {
    const taskLinks: DesignLink[] = [];
    const metaFile = path.join(taskPath, "metadata.json");
    if (existsSync(metaFile)) {
      try {
        const metaText = readFileSync(metaFile, "utf8");
        taskLinks.push(...inspectJiraTaskText(metaText).designLinks);
      } catch {}
    }
    const workFile = path.join(taskPath, "WORK.md");
    if (existsSync(workFile)) {
      try {
        const workText = readFileSync(workFile, "utf8");
        taskLinks.push(...extractDesignLinksFromText(workText));
      } catch {}
    }
    let addedCount = 0;
    for (const link of taskLinks) {
      if (!designLinks.some((l) => l.url === link.url)) {
        designLinks.push(link);
        addedCount++;
      }
    }
    if (addedCount > 0) {
      notes.push(`Discovered ${addedCount} design link(s) in active task workspace`);
    }
  }

  const renderDir = args.out ? path.resolve(args.out) : args.render && taskPath ? path.join(taskPath, "evidence") : undefined;

  const resolvedScreens = await resolveZeplinLinks(designLinks, fetchFn, renderDir);
  for (const screen of resolvedScreens) {
    if (screen.status !== "SUCCESS") notes.push(`Zeplin resolution status: ${screen.status}`);
  }

  const resolvedFigma = await resolveFigmaLinks(designLinks, fetchFn, renderDir);
  for (const fig of resolvedFigma) {
    if (fig.status !== "SUCCESS") notes.push(`Figma resolution status: ${fig.status}`);
  }

  const uiSensitive = inspection.androidUIStack !== "n/a" || designLinks.length > 0;
  const evidenceStatus = determineEvidenceStatus(designLinks, uiSensitive);

  const preflight: PreflightResult = {
    uiSensitive,
    androidUIStack: inspection.androidUIStack,
    architectureType: inspection.architectureType,
    evidenceStatus,
    designLinks,
    resolvedScreens: resolvedScreens.length ? resolvedScreens : undefined,
    resolvedFigma: resolvedFigma.length ? resolvedFigma : undefined,
    components: inspection.components,
    notes,
  };

  const outputFormat = args.json ? "json" : args.markdown ? "markdown" : "human";
  console.log(formatDesignBrief(args.task, preflight, outputFormat));
}
