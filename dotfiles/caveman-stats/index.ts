import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("caveman-stats", {
    description: "Show real token usage and estimated savings.",
    handler: async (_args, ctx) => {
      const usage = ctx.getContextUsage();
      if (!usage) {
        ctx.ui.notify("No stats available yet. Talk to the model first.", "warning");
        return;
      }
      
      const tokens = usage.tokens;
      if (tokens == null) {
        ctx.ui.notify("No token count available yet. Talk to the model first.", "warning");
        return;
      }

      const estimatedSavings = Math.floor(tokens * 0.65);
      const percent = usage.percent == null ? "unknown" : `${usage.percent.toFixed(1)}%`;

      const msg = [
        "Caveman Stats (Pi Native)",
        "-------------------------",
        `Context Tokens : ${tokens.toLocaleString()}`,
        `Context Window : ${usage.contextWindow.toLocaleString()}`,
        `Context Used   : ${percent}`,
        "",
        `Estimated Tokens Saved: ~${estimatedSavings.toLocaleString()} (assuming 65% prose compression)`
      ].join("\n");
      
      ctx.ui.notify(msg, "info");
    }
  });
}
