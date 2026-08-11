import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import type { WorkflowContext } from "./types.js";

export interface WorkflowAdapter {
  name: string;
  detect(cwd: string): boolean;
  getContext(cwd: string): WorkflowContext | null;
  attach(context: WorkflowContext, artifacts: { html: string; record: string }): void;
}

function appendLogEntry(filePath: string, message: string): void {
  if (!existsSync(filePath)) return;
  try {
    const text = readFileSync(filePath, "utf-8");
    const entry = `- ${new Date().toISOString()}: ${message}`;
    if (!/^(## )?\[LOG\]\s*$/m.test(text)) {
      writeFileSync(filePath, `${text.trimEnd()}\n\n## [LOG]\n${entry}\n`);
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
    writeFileSync(filePath, `${[...before, ...after].join("\n").replace(/\n*$/, "\n")}`);
  } catch { }
}

function appendWorkLogEntry(taskDir: string, message: string): void {
  appendLogEntry(path.join(taskDir, "WORK.md"), message);
}

export class ActiveWorkflowAdapter implements WorkflowAdapter {
  name = "workflow";
  detect(cwd: string): boolean {
    return existsSync(path.join(cwd, ".workflow", "active.json")) || existsSync(path.join(cwd, ".workflow", "active_workflow.json"));
  }
  getContext(cwd: string): WorkflowContext | null {
    try {
      const activePath = existsSync(path.join(cwd, ".workflow", "active.json"))
        ? path.join(cwd, ".workflow", "active.json")
        : path.join(cwd, ".workflow", "active_workflow.json");
      const content = JSON.parse(readFileSync(activePath, "utf-8"));
      const taskPath = typeof content.stateFile === "string" ? content.stateFile : null;
      const rawTaskId = typeof content.taskId === "string" ? content.taskId : (typeof content.id === "string" ? content.id : null);
      const rawTaskDir = typeof content.taskPath === "string"
        ? path.resolve(cwd, content.taskPath)
        : (taskPath ? path.dirname(path.resolve(cwd, taskPath)) : null);
      return {
        workflow: typeof content.workflow === "string" ? content.workflow : this.name,
        taskId: rawTaskId,
        taskPath,
        taskDir: rawTaskDir
      };
    } catch { return null; }
  }
  attach(context: WorkflowContext, artifacts: { html: string; record: string }): void {
    if (!context.taskPath || !context.taskDir) return;
    appendLogEntry(path.join(context.taskDir, path.basename(context.taskPath)), `notrace retrospective: ${artifacts.html}`);
  }
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

const ADAPTERS: WorkflowAdapter[] = [new ActiveWorkflowAdapter(), new NorpivAdapter(), new ResearchAdapter(), new GenericAdapter()];

export function getActiveAdapter(cwd: string): WorkflowAdapter {
  return ADAPTERS.find(a => a.detect(cwd)) || new GenericAdapter();
}
