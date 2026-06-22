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
      
      const inTokens = usage.inputTokens || 0;
      const outTokens = usage.outputTokens || 0;
      const total = inTokens + outTokens;
      
      // Estimated savings for prose compression (~46% reduction for caveman-compress logic)
      // or standard mode savings (~65% from benchmarks). We'll use 65% for full mode.
      const estimatedSavings = Math.floor(inTokens * 0.65);
      
      const msg = [
        "Caveman Stats (Pi Native)",
        "-------------------------",
        `Input Tokens : ${inTokens.toLocaleString()}`,
        `Output Tokens: ${outTokens.toLocaleString()}`,
        `Total Tokens : ${total.toLocaleString()}`,
        "",
        `Estimated Tokens Saved: ~${estimatedSavings.toLocaleString()} (assuming 65% prose compression)`
      ].join("\n");
      
      ctx.ui.notify(msg, "info");
    }
  });
}
