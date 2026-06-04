import { basename } from "node:path";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { CustomEditor, type ExtensionAPI, type KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, type EditorTheme, type TUI } from "@earendil-works/pi-tui";

// Dracula VIBRANT Palette
const VIBRANT = {
  bg: "#282a36",
  cyan: "#8be9fd",
  green: "#50fa7b",
  orange: "#ffb86c",
  pink: "#ff79c6",
  purple: "#bd93f9",
  yellow: "#f1fa8c",
};

// Dracula PALE Palette (5% More Color)
const PALE = {
  bg: "#1e1f29",
  cyan: "#8da8a8",
  green: "#8da88d",
  orange: "#a8968d",
  pink: "#b896a4",
  purple: "#9b9bc0",
  yellow: "#b8b88d",
};

type Segment = {
  text: string;
  bg: string; // Hex
  fg: string; // Hex
};

const LEFT_CAP = "";
const RIGHT_CAP = "";
const SEPARATOR_RIGHT = "";
const SEPARATOR_LEFT = "";
const SPACE = " ";

function hexToRgb(hex: string) {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return { r, g, b };
}

function toAnsiBg(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `\x1b[48;2;${r};${g};${b}m`;
}

function toAnsiFg(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}

const ANSI_RESET_BG = "\x1b[49m";
const ANSI_RESET_FG = "\x1b[39m";

function kFormat(num: number): string {
  if (!Number.isFinite(num)) return "0";
  const abs = Math.abs(num);
  const fmt = (value: number, suffix: string) => `${String(Number(value.toFixed(1))).replace(/\.0$/, "")}${suffix}`;
  if (abs < 1000) return `${Math.round(num)}`;
  if (abs < 1000000) return fmt(num / 1000, "k");
  if (abs < 1000000000) return fmt(num / 1000000, "M");
  if (abs < 1000000000000) return fmt(num / 1000000000, "B");
  return fmt(num / 1000000000000, "T");
}

function formatCost(cost: number): string {
  if (!Number.isFinite(cost) || cost <= 0) return "0.00";
  return cost.toFixed(2);
}

function formatHeaderTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function shortProvider(provider: string): string {
  const normalized = provider.toLowerCase();

  if (normalized.includes("copilot") || normalized.startsWith("github") || normalized.startsWith("gith")) {
    return "copilot";
  }
  if (normalized.startsWith("openai") || normalized === "open") return "openai";
  if (normalized.startsWith("codex")) return "codex";
  if (normalized.startsWith("gemini") || normalized.startsWith("google-gemini") || normalized === "google") return "gemini";
  if (normalized.startsWith("vertex") || normalized.startsWith("google-vertex")) return "vertex";
  if (normalized.startsWith("anthropic")) return "anthropic";
  if (normalized.startsWith("groq")) return "groq";
  if (normalized.startsWith("xai")) return "xai";
  if (normalized.startsWith("mistral")) return "mstr";
  if (normalized.startsWith("deepseek")) return "dsk";
  if (normalized.startsWith("fireworks")) return "fwk";
  if (normalized.startsWith("openrouter")) return "openrouter";
  if (normalized.startsWith("ollama")) return "ollama";
  if (normalized.startsWith("lmstudio")) return "lm";
  if (normalized.startsWith("bedrock") || normalized.startsWith("amazon-bedrock")) return "bed";
  if (normalized.startsWith("cloudflare")) return "cf";
  if (normalized.startsWith("azure")) return "az";
  if (normalized.startsWith("huggingface")) return "hf";
  if (normalized.startsWith("antigravity")) return "antigravity";

  return normalized.slice(0, 4);
}

function shortThinking(level: string): string {
  const map: Record<string, string> = {
    off: "off",
    minimal: "mi",
    low: "l",
    medium: "med",
    high: "h",
    xhigh: "xh",
    x_high: "xh",
  };
  return map[level] ?? level;
}

function middleTruncate(text: string, maxWidth: number): string {
  if (visibleWidth(text) <= maxWidth) return text;
  if (maxWidth <= 1) return "…";
  if (maxWidth === 2) return "..";
  const keep = Math.floor((maxWidth - 1) / 2);
  const left = text.slice(0, keep);
  const right = text.slice(text.length - (maxWidth - 1 - keep));
  return `${left}…${right}`;
}

function fitBorder(left: string, right: string, width: number): string {
  if (width <= 0) return "";
  if (width === 1) return "─";

  let leftText = left;
  let rightText = right;
  const fixedWidth = 2;
  const minimumGap = 1;

  while (
    fixedWidth + visibleWidth(leftText) + visibleWidth(rightText) + minimumGap > width &&
    visibleWidth(rightText) > 0
  ) {
    rightText = truncateToWidth(rightText, Math.max(0, visibleWidth(rightText) - 1), "");
  }
  while (
    fixedWidth + visibleWidth(leftText) + visibleWidth(rightText) + minimumGap > width &&
    visibleWidth(leftText) > 0
  ) {
    leftText = truncateToWidth(leftText, Math.max(0, visibleWidth(leftText) - 1), "");
  }

  const gapWidth = Math.max(0, width - fixedWidth - visibleWidth(leftText) - visibleWidth(rightText));
  return `─${leftText}${"─".repeat(gapWidth)}${rightText}─`;
}

function renderPowerline(segments: Segment[], separator = SEPARATOR_RIGHT, trailing = true, startCap = LEFT_CAP): string {
  let line = "";
  const firstSeg = segments[0];
  if (firstSeg) {
    line += toAnsiFg(firstSeg.bg) + ANSI_RESET_BG + startCap;
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const nextSeg = segments[i + 1];
    line += toAnsiBg(seg.bg) + toAnsiFg(seg.fg) + seg.text;
    if (nextSeg) {
      line += toAnsiBg(nextSeg.bg) + toAnsiFg(seg.bg) + separator;
    } else if (trailing) {
      line += ANSI_RESET_BG + toAnsiFg(seg.bg) + separator + ANSI_RESET_FG;
    } else {
      line += ANSI_RESET_BG + ANSI_RESET_FG;
    }
  }
  return line;
}

export default function (pi: ExtensionAPI) {
  // Command to cycle theme
  pi.registerCommand("cycle-theme", {
    description: "Cycle between vibrant and pale Dracula themes",
    handler: async (_args, ctx) => {
      const current = ctx.ui.theme.name;
      const next = current === "dracula-vibrant" ? "ghostly-pale" : "dracula-vibrant";
      
      const result = ctx.ui.setTheme(next);
      if (result.success) {
        ctx.ui.notify(`Switched: ${current} → ${next}`, "info");
      } else {
        ctx.ui.notify(`Error switching to ${next}: ${result.error}`, "error");
      }
    },
  });

  pi.on("session_start", async (event, ctx) => {
    if (!ctx.hasUI) return;

    let branchName: string | undefined;

    const refreshBranch = async () => {
      const result = await pi.exec("git", ["branch", "--show-current"], { cwd: ctx.cwd }).catch(() => undefined);
      const stdout = result?.stdout.trim();
      branchName = stdout && stdout.length > 0 ? stdout : undefined;
    };
    await refreshBranch();

    class BranchEditor extends CustomEditor {
      constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) {
        super(tui, theme, keybindings, { paddingX: 0 });
      }

      render(width: number): string[] {
        const lines = super.render(width);
        if (lines.length < 2) return lines;

        const branchDisplay = branchName ? middleTruncate(branchName, Math.max(8, width - 6)) : "";
        const topRight = branchDisplay ? ctx.ui.theme.fg("muted", `  ${branchDisplay} `) : "";

        const modelId = ctx.model?.id ?? "no-model";
        const thinkingLevel = pi.getThinkingLevel?.() ?? "off";
        const modelText = ctx.model?.reasoning ? `${modelId} • ${thinkingLevel}` : modelId;
        const providerText = ctx.model?.provider ? `${shortProvider(ctx.model.provider)} / ` : "";
        const bottomRight = ctx.ui.theme.fg("muted", ` 󱐋 ${truncateToWidth(`${providerText}${modelText}`, 60, "…")} `);

        lines[0] = fitBorder("", topRight, width);
        lines[lines.length - 1] = fitBorder("", bottomRight, width);
        return lines;
      }
    }

    ctx.ui.setEditorComponent((tui, theme, keybindings) => new BranchEditor(tui, theme, keybindings));

    ctx.ui.setFooter((tui, theme, footerData) => {
      const dispose = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose,
        invalidate() {},
        render(width: number): string[] {
          let totalInput = 0;
          let totalOutput = 0;
          let totalCost = 0;
          let totalCacheRead = 0;

          for (const entry of ctx.sessionManager.getBranch()) {
            if (entry.type !== "message" || entry.message.role !== "assistant") continue;
            const m = entry.message as AssistantMessage;
            const usage = m.usage;
            if (usage) {
              totalInput += usage.input;
              totalOutput += usage.output;
              totalCost += usage.cost.total;
              totalCacheRead += (usage as any).cacheRead ?? 0;
            }
          }

          const contextUsage = ctx.getContextUsage?.();
          const contextPercent =
            typeof contextUsage?.percent === "number" ? contextUsage.percent.toFixed(1) : "?";
          const contextWindow = contextUsage?.contextWindow;
          const contextWindowText = typeof contextWindow === "number" ? kFormat(contextWindow) : "?";

          const themeName = (theme.name || "theme").toLowerCase();
          const p = themeName === "ghostly-pale" ? PALE : VIBRANT;

          const leftSegments: Segment[] = [
            { text: ` 󰁝 ${kFormat(totalInput)} `, bg: p.green, fg: p.bg },
            { text: ` 󰁅 ${kFormat(totalOutput)} `, bg: p.purple, fg: p.bg },
            { text: ` 󰌪 ${kFormat(totalCacheRead)} `, bg: p.yellow, fg: p.bg },
            { text: ` 󱍢 $${formatCost(totalCost)} `, bg: p.orange, fg: p.bg },
            { text: ` 󰆼 ${contextPercent}%/${contextWindowText} `, bg: p.cyan, fg: p.bg },
          ];
          const left = renderPowerline(leftSegments, SEPARATOR_RIGHT, true, "");

          const statuses = Array.from(footerData.getExtensionStatuses().values())
            .filter((value): value is string => Boolean(value))
            .join(" ");
          const footerLine = statuses ? `${left}${SPACE}${theme.fg("dim", statuses)}` : left;
          return [truncateToWidth(footerLine, width, "")];
        },
      };
    });
  });
}
