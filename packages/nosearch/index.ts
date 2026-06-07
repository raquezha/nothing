import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

const NOSEARCH_PKG_ROOT = path.dirname(new URL(import.meta.url).pathname);
const BRAVE_SKILL = path.join(NOSEARCH_PKG_ROOT, "brave-search");
const FIRECRAWL_SKILL = path.join(NOSEARCH_PKG_ROOT, "firecrawl");
const CHILD_FLAGS = [
  "--no-skills",
  "--no-extensions",
  "--no-context-files",
  "--no-prompt-templates",
  "--no-themes",
  "--no-session",
  "--mode",
  "json",
  "--tools",
  "bash",
];

type SubagentResult = {
  text: string;
  rawStdout: string;
  rawStderr: string;
  exitCode: number;
};

function ensureSkillPath(skillPath: string, label: string): void {
  if (!existsSync(skillPath)) {
    throw new Error(`Missing ${label} skill at ${skillPath}. Run ./scripts/setup.sh first.`);
  }
}

function extractFinalText(stdout: string): string {
  let final = "";

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as { type?: string; message?: { role?: string; content?: Array<{ type?: string; text?: string }> } };
      if (event.type !== "message_end" || event.message?.role !== "assistant") continue;
      const text = event.message.content
        ?.filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("\n")
        .trim();
      if (text) final = text;
    } catch {
      // ignore non-JSON lines
    }
  }

  return final.trim();
}

function runChildPi(args: string[], signal?: AbortSignal): Promise<SubagentResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("pi", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const abort = () => {
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
      }, 3000);
    };

    if (signal) {
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      const text = extractFinalText(stdout) || stdout.trim();
      resolve({ text, rawStdout: stdout, rawStderr: stderr, exitCode: code ?? 0 });
    });
  });
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("nosearch.smoke", {
    description: "Run a deterministic child-pi smoke test for the nosearch subagent wiring.",
    handler: async (_args, ctx) => {
      const child = await runChildPi(
        [
          "--no-skills",
          "--no-extensions",
          "--no-context-files",
          "--no-prompt-templates",
          "--no-themes",
          "--no-session",
          "--mode",
          "json",
          "-p",
          "Say exactly: Yes, my lord. I'm here to serve.",
        ],
        ctx.signal,
      );

      const phrase = child.exitCode === 0 ? "Yes, my lord. I'm here to serve." : "Smoke test failed.";
      ctx.ui.notify(phrase, child.exitCode === 0 ? "info" : "error");

      if (child.exitCode !== 0) {
        throw new Error(child.rawStderr.trim() || child.text || `search subagent smoke failed with exit code ${child.exitCode}`);
      }

      return;
    },
  });

  const params = Type.Object(
    {
      backend: StringEnum(["brave", "firecrawl"] as const, { description: "Which search backend to delegate to." }),
      mode: StringEnum(["search", "scrape", "map"] as const, {
        description: "Firecrawl mode. Ignored for Brave.",
        default: "search",
      }),
      query: Type.Optional(Type.String({ description: "Search query." })),
      url: Type.Optional(Type.String({ description: "Target URL for Firecrawl scrape/map." })),
      limit: Type.Optional(Type.Integer({ description: "Result limit for backend search." })),
    },
    { additionalProperties: false },
  );

  pi.registerTool({
    name: "search_subagent",
    label: "Search Subagent",
    description:
      "Spawns a fresh pi child process with an isolated context and delegates Brave Search or Firecrawl work there.",
    promptSnippet: "Delegate web search, site mapping, or scraping to an isolated subagent.",
    promptGuidelines: [
      "Use search_subagent for Brave Search and Firecrawl work instead of searching in the main session.",
      "Use search_subagent so the search happens in a fresh pi context and returns a compact result to the main agent.",
    ],
    parameters: params,

    async execute(_toolCallId, input, signal, onUpdate, ctx) {
      const backend = input.backend;
      const limit = typeof input.limit === "number" && Number.isFinite(input.limit) ? input.limit : undefined;
      const mode = input.mode ?? "search";

      onUpdate?.({
        content: [{ type: "text", text: `Spawning ${backend} search subagent...` }],
        details: { backend, mode, status: "starting" },
      });

      let childArgs: string[];
      let prompt: string;

      if (backend === "brave") {
        if (!input.query?.trim()) {
          throw new Error("brave backend requires query.");
        }
        ensureSkillPath(BRAVE_SKILL, "Brave Search");
        prompt = `/skill:brave-search ${input.query.trim()}\n\nReturn a concise answer with the best results and URLs.`;
        if (limit !== undefined) prompt += `\nLimit to ${limit} results.`;
        childArgs = [...CHILD_FLAGS, "--skill", BRAVE_SKILL, "-p", prompt];
      } else {
        ensureSkillPath(FIRECRAWL_SKILL, "Firecrawl");

        if (mode === "scrape") {
          if (!input.url?.trim()) throw new Error("firecrawl scrape requires url.");
          prompt = `/skill:firecrawl scrape ${input.url.trim()}\n\nReturn the extracted page content concisely.`;
        } else if (mode === "map") {
          if (!input.url?.trim()) throw new Error("firecrawl map requires url.");
          prompt = `/skill:firecrawl map ${input.url.trim()}\n\nReturn the discovered URLs concisely.`;
          if (limit !== undefined) prompt += `\nLimit to ${limit} URLs.`;
        } else {
          if (!input.query?.trim()) throw new Error("firecrawl search requires query.");
          prompt = `/skill:firecrawl search ${input.query.trim()}\n\nReturn concise results with URLs and summaries.`;
          if (limit !== undefined) prompt += `\nLimit to ${limit} results.`;
        }

        childArgs = [...CHILD_FLAGS, "--skill", FIRECRAWL_SKILL, "-p", prompt];
      }

      const child = await runChildPi(childArgs, signal);

      if (child.exitCode !== 0) {
        throw new Error(child.rawStderr.trim() || child.text || `search subagent failed with exit code ${child.exitCode}`);
      }

      const text = child.text || "(no output)";
      onUpdate?.({
        content: [{ type: "text", text }],
        details: { backend, mode, status: "done" },
      });

      return {
        content: [{ type: "text", text }],
        details: {
          backend,
          mode,
          exitCode: child.exitCode,
          rawStdout: child.rawStdout,
        },
      };
    },
  });
}
