import path from "node:path";
import type { ParsedArgs } from "./args.js";
import { parseDesignLink, formatAgentDirective, formatTreeBlueprint } from "../brief.js";
import { findWorkflowTaskPath } from "./resolvers.js";
import { resolveZeplinScreen } from "../zeplin.js";
import { resolveFigmaLink } from "../figma.js";
import { inspectAndroidProject, scanColorTokens } from "../android.js";
import { generateGroundingManifest, formatGroundingManifestMarkdown } from "../manifest.js";
import { generateCodeSnippet } from "../code.js";
import { color, statusColor, printStep, printList, printNote } from "./output.js";

export async function handleExtractCommand(args: ParsedArgs, fetchFn: typeof fetch): Promise<void> {
  const parsed = parseDesignLink(args.url);
  const taskPath = findWorkflowTaskPath(process.cwd());
  const defaultDir = taskPath ? path.join(taskPath, "evidence") : path.resolve(process.cwd(), "design-renders");
  const outputDir = args.out ? path.resolve(args.out) : args.render ? defaultDir : undefined;
  const zeplin = parsed.link.provider === "zeplin"
    ? await resolveZeplinScreen(parsed.link.url, undefined, outputDir, fetchFn)
    : undefined;
  const figma = parsed.link.provider === "figma"
    ? await resolveFigmaLink(parsed.link.url, undefined, outputDir, fetchFn, args.find)
    : undefined;

  const providerResult = zeplin || figma;
  if (providerResult && providerResult.status !== "SUCCESS") {
    process.exitCode = 1;
  }

  const hierarchy = zeplin?.extract?.hierarchy || figma?.extract?.hierarchy || [];
  const extractedColors = (zeplin?.extract?.colors || figma?.extract?.colors || zeplin?.screen?.colors || []);
  const screenName = zeplin?.name || figma?.name || "ExtractedScreen";
  const inspection = inspectAndroidProject(args.path || process.cwd());
  const colorTokens = scanColorTokens(args.path || process.cwd());
  const codeContext = { components: inspection.components, colorTokens, architectureType: inspection.architectureType, androidUIStack: inspection.androidUIStack };
  const archDetailNote = inspection.notes.find((n) => n.startsWith("Project Architecture Structure:")) || inspection.architectureType;
  const manifest = generateGroundingManifest(hierarchy, screenName, codeContext, extractedColors);

  if (args.manifest) {
    if (providerResult && providerResult.status !== "SUCCESS") {
      const errNote = providerResult.errorDescription || providerResult.note || `Provider status: ${providerResult.status}`;
      if (args.json) {
        console.log(JSON.stringify({ status: providerResult.status, error: errNote, manifest: null }, null, 2));
      } else {
        console.error(`\x1b[31mError (${providerResult.status}):\x1b[0m ${errNote}`);
      }
      return;
    }

    if (args.json) {
      console.log(JSON.stringify(manifest, null, 2));
    } else {
      console.log(formatGroundingManifestMarkdown(manifest));
    }
    return;
  }

  if (args.json) {
    console.log(JSON.stringify({
      ...parsed,
      directive: formatAgentDirective(screenName, inspection.architectureType, archDetailNote, inspection.androidUIStack),
      manifest,
      ...(zeplin ? { zeplin } : {}),
      ...(figma ? { figma } : {}),
      ...(args.code ? { code: generateCodeSnippet(hierarchy, args.code, screenName, codeContext) } : {}),
    }, null, 2));
    return;
  }

  if (args.markdown) {
    console.log(formatAgentDirective(screenName, inspection.architectureType, archDetailNote, inspection.androidUIStack));
    console.log(`\n# Extracted Design: ${screenName}\n`);
    console.log(`- **Provider**: ${parsed.link.provider}`);
    console.log(`- **URL**: ${parsed.link.url}`);
    console.log(`- **Status**: ${providerResult?.status || parsed.status}`);
    if (hierarchy.length) {
      console.log("\n## UI Blueprint\n```text");
      for (const line of formatTreeBlueprint(hierarchy, 0)) console.log(line);
      console.log("```");
    }
    if (args.code) {
      console.log(`\n## Generated Code (${args.code})\n\`\`\`${args.code === "compose" ? "kotlin" : args.code === "react" ? "tsx" : "html"}`);
      if (hierarchy.length === 0) {
        console.log(`// No child layers or UI elements found in frame '${screenName}'. Select a frame containing UI elements to generate code.`);
      } else {
        console.log(generateCodeSnippet(hierarchy, args.code, screenName, codeContext));
      }
      console.log("```");
    }
    return;
  }

  console.log(`\n${color.cyan}┌${color.reset} ${color.bold}${color.cyan}nodesign extract${color.reset}`);
  printStep("Link", `[${parsed.link.provider}] ${parsed.link.url}`);
  printStep("Project", inspection.architectureType);
  console.log(`${color.cyan}│${color.reset}`);
  console.log(`${statusColor(providerResult?.status || parsed.status)}◆${color.reset} ${color.bold}Status${color.reset} ${color.dim}›${color.reset} ${providerResult?.status || parsed.status}`);
  if (parsed.note) printNote("Parse", parsed.note);

  if (zeplin) {
    printStep("Screen ID", zeplin.screenId);
    printStep("Name", zeplin.name);
    if (zeplin.screen?.colors.length) printList("Colors", zeplin.screen.colors.map((c: any) => c.hex));
    if (zeplin.extract?.typography.length) printList("Typography", zeplin.extract.typography.map((t: any) => `${t.fontFamily || "font"} ${t.fontSize || ""}px`));
    if (zeplin.extract?.layout.width || zeplin.extract?.layout.height) printStep("Layout", `${zeplin.extract.layout.width || 0}x${zeplin.extract.layout.height || 0}`);
    if (zeplin.extract?.hierarchy.length) printList("UI Blueprint", formatTreeBlueprint(zeplin.extract.hierarchy, 1));
    printStep("Rendered Image", zeplin.renderedImage);
    printList("Saved Assets", zeplin.savedAssets);
    printNote("What happened", zeplin.errorDescription);
    printList("Suggested Screens", zeplin.suggestedScreens);
    printNote("Zeplin", zeplin.note && zeplin.note !== zeplin.errorDescription ? zeplin.note : undefined);
  }
  if (figma) {
    printStep("File", figma.fileKey ? `${figma.fileKey}${figma.nodeId ? ` (Node ID: ${figma.nodeId})` : ""}` : undefined);
    printStep("Name", figma.name);
    if (figma.extract?.colors.length) printList("Colors", figma.extract.colors.map((c: any) => c.hex));
    if (figma.extract?.typography.length) printList("Typography", figma.extract.typography.map((t: any) => `${t.fontFamily || "font"} ${t.fontSize || ""}px`));
    if (figma.extract?.layout.width || figma.extract?.layout.height) printStep("Layout", `${figma.extract.layout.width || 0}x${figma.extract.layout.height || 0}`);
    if (figma.extract?.hierarchy.length) printList("UI Blueprint", formatTreeBlueprint(figma.extract.hierarchy, 1));
    printStep("Rendered Image", figma.renderedImage);
    printNote("What happened", figma.errorDescription);
    printList("Suggested Frames", figma.suggestedFrames);
    printNote("Figma", figma.note && figma.note !== figma.errorDescription ? figma.note : undefined);
  }
  console.log(`${color.cyan}│${color.reset}`);
  console.log(`${color.cyan}└${color.reset} ${color.dim}zero-drift contract active; use --markdown or --json for full agent payload${color.reset}`);
  if (args.code) {
    console.log(`\n${color.bold}Generated Code (${args.code})${color.reset}`);
    if (hierarchy.length === 0) {
      console.log(`${color.yellow}◆${color.reset} ${color.dim}No child layers found in frame '${screenName}'. Select a frame with UI content to generate code.${color.reset}`);
    } else {
      console.log(generateCodeSnippet(hierarchy, args.code, screenName, codeContext));
    }
  }
}
