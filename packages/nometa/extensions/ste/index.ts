import { readFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const instructions = readFileSync(new URL("../../../../dotfiles/ste.md", import.meta.url), "utf8");

export default function ste(pi: ExtensionAPI) {
  pi.on("before_agent_start", (event) => {
    const options = event.systemPromptOptions as { sections?: Record<string, string>; forceSystemPrompt?: string };
    if (options.sections && options.forceSystemPrompt === undefined) {
      options.sections.ste = instructions;
      return;
    }
    // Older Pi and explicit prompt overrides need the rendered prompt preserved.
    return { systemPrompt: `${event.systemPrompt}\n\n${instructions}` };
  });
}
