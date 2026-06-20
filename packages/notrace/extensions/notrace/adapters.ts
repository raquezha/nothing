import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import type { WorkflowContext } from "./types.js";

export interface WorkflowAdapter {
  name: string;
  detect(cwd: string): boolean;
  getContext(cwd: string): WorkflowContext | null;
  attach(context: WorkflowContext, artifacts: { html: string; record: string }): void;
}

function appendWorkLogEntry(taskDir: string, message: string): void {
  const workMd = path.join(taskDir, "WORK.md");
  if (!existsSync(workMd)) return;
  try {
    const text = readFileSync(workMd, "utf-8");
    const entry = `- ${new Date().toISOString()}: ${message}`;
    if (!/^(## )?\[LOG\]\s*$/m.test(text)) {
      writeFileSync(workMd, `${text.trimEnd()}\n\n## [LOG]\n${entry}\n`);
      return;
    }
    const lines = text.split("\n");
    const logIndex = lines.findIndex(l => /^(## )?\[LOG\]\s*$/.test(l));
    let nextSection = lines.length;
    for (let i = logIndex + 1; i < lines.length; i++) {
      if (/^(## )?\[[A-Z0-9_-]+\]\s*$/.test(lines[i])) {
        nextSection = i;
        break;
      }
    }
    const before = lines.slice(0, nextSection);
    const after = lines.slice(nextSection);
    while (before.length > logIndex + 1 && before[before.length - 1]?.trim() === "") {
      before.pop();
    }
    before.push(entry);
    writeFileSync(workMd, `${[...before, ...after].join("\n").replace(/\n*$/, "\n")}`);
  } catch { }
}

export class NorpivAdapter implements WorkflowAdapter {
  name = "norpiv";
  detect(cwd: string): boolean {
    return existsSync(path.join(cwd, ".workflow", "active_task.json"));
  }
  getContext(cwd: string): WorkflowContext | null {
    try {
      const workflowDir = path.join(cwd, ".workflow");
      const content = JSON.parse(readFileSync(path.join(workflowDir, "active_task.json"), "utf-8"));
      const taskPath = content.taskPath || (content.active_task ? path.join("tasks", content.active_task) : null);
      return {
        workflow: this.name,
        taskId: content.active_task || "unknown",
        taskPath,
        taskDir: taskPath ? path.resolve(cwd, taskPath) : null
      };
    } catch { return null; }
  }
  attach(context: WorkflowContext, artifacts: { html: string; record: string }): void {
    if (!context.taskDir) return;
    appendWorkLogEntry(context.taskDir, `notrace retrospective: ${artifacts.html}`);
  }
}

export class ResearchAdapter implements WorkflowAdapter {
  name = "research";
  detect(cwd: string): boolean {
    return existsSync(path.join(cwd, ".git")) && !existsSync(path.join(cwd, ".workflow", "active_task.json"));
  }
  getContext(cwd: string): WorkflowContext | null {
    try {
      const head = readFileSync(path.join(cwd, ".git", "HEAD"), "utf-8");
      const branch = head.split("refs/heads/")[1]?.trim() || "main";
      return { workflow: this.name, taskId: `branch:${branch}`, taskPath: null, taskDir: null };
    } catch { return null; }
  }
  attach(): void { }
}

export class GenericAdapter implements WorkflowAdapter {
  name = "generic";
  detect() { return true; }
  getContext() { return null; }
  attach() { }
}

const ADAPTERS: WorkflowAdapter[] = [new NorpivAdapter(), new ResearchAdapter(), new GenericAdapter()];

export function getActiveAdapter(cwd: string): WorkflowAdapter {
  return ADAPTERS.find(a => a.detect(cwd)) || new GenericAdapter();
}
