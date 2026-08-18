import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import type { WorkflowContext } from "./types.js";

export interface WorkflowAdapter {
  name: string;
  detect(cwd: string): boolean;
  getContext(cwd: string): WorkflowContext | null;
  attach(context: WorkflowContext, artifacts: { html: string; record: string }): void;
}

const POINTER_ACTIVE = path.join(".workflow", "active.json");
const POINTER_ACTIVE_WORKFLOW_LEGACY = path.join(".workflow", "active_workflow.json");
const POINTER_ACTIVE_TASK_LEGACY = path.join(".workflow", "active_task.json");

function resolvePointerFile(cwd: string, relativePaths: string[]): string | null {
  for (const relPath of relativePaths) {
    const fullPath = path.join(cwd, relPath);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

function appendLogEntry(filePath: string, message: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  try {
    const text = readFileSync(filePath, "utf-8");
    const timestamp = new Date().toISOString();
    const entry = `- ${timestamp}: ${message}`;

    if (!/^(## )?\[LOG\]\s*$/m.test(text)) {
      writeFileSync(filePath, `${text.trimEnd()}\n\n## [LOG]\n${entry}\n`);
      return;
    }

    const lines = text.split("\n");
    const logIndex = lines.findIndex((line) => /^(## )?\[LOG\]\s*$/.test(line));

    let nextSectionIndex = lines.length;
    for (let i = logIndex + 1; i < lines.length; i++) {
      if (/^(## )?\[[A-Z0-9_-]+\]\s*$/.test(lines[i])) {
        nextSectionIndex = i;
        break;
      }
    }

    const before = lines.slice(0, nextSectionIndex);
    const after = lines.slice(nextSectionIndex);

    while (before.length > logIndex + 1 && before[before.length - 1]?.trim() === "") {
      before.pop();
    }

    before.push(entry);
    writeFileSync(filePath, `${[...before, ...after].join("\n").replace(/\n*$/, "\n")}`);
  } catch {
    // Fail-open on log append errors
  }
}

function appendWorkLogEntry(taskDir: string, message: string): void {
  appendLogEntry(path.join(taskDir, "WORK.md"), message);
}

export class ActiveWorkflowAdapter implements WorkflowAdapter {
  name = "workflow";

  detect(cwd: string): boolean {
    return resolvePointerFile(cwd, [POINTER_ACTIVE, POINTER_ACTIVE_WORKFLOW_LEGACY]) !== null;
  }

  getContext(cwd: string): WorkflowContext | null {
    const pointerFile = resolvePointerFile(cwd, [POINTER_ACTIVE, POINTER_ACTIVE_WORKFLOW_LEGACY]);
    if (!pointerFile) {
      return null;
    }

    try {
      const raw = readFileSync(pointerFile, "utf-8");
      const content = JSON.parse(raw);

      const stateFile = typeof content.stateFile === "string" ? content.stateFile : null;
      const taskId = typeof content.taskId === "string"
        ? content.taskId
        : typeof content.id === "string"
          ? content.id
          : null;

      let taskDir: string | null = null;
      if (typeof content.taskPath === "string") {
        taskDir = path.resolve(cwd, content.taskPath);
      } else if (stateFile) {
        taskDir = path.dirname(path.resolve(cwd, stateFile));
      }

      const role = typeof content.role === "string"
        ? content.role
        : (process.env.NOCHESTRA_ROLE || process.env.PI_ROLE || null);

      return {
        workflow: typeof content.workflow === "string" ? content.workflow : this.name,
        taskId,
        taskPath: stateFile,
        taskDir,
        role,
      };
    } catch {
      return null;
    }
  }

  attach(context: WorkflowContext, artifacts: { html: string; record: string }): void {
    if (!context.taskPath || !context.taskDir) {
      return;
    }
    const targetFile = path.join(context.taskDir, path.basename(context.taskPath));
    appendLogEntry(targetFile, `notrace retrospective: ${artifacts.html}`);
  }
}

export class NorpivAdapter implements WorkflowAdapter {
  name = "norpiv";

  detect(cwd: string): boolean {
    return existsSync(path.join(cwd, POINTER_ACTIVE_TASK_LEGACY));
  }

  getContext(cwd: string): WorkflowContext | null {
    const pointerFile = path.join(cwd, POINTER_ACTIVE_TASK_LEGACY);
    if (!existsSync(pointerFile)) {
      return null;
    }

    try {
      const raw = readFileSync(pointerFile, "utf-8");
      const content = JSON.parse(raw);

      const taskPath = content.taskPath || (content.active_task ? path.join("tasks", content.active_task) : null);
      const taskId = content.active_task || "unknown";
      const taskDir = taskPath ? path.resolve(cwd, taskPath) : null;

      const role = typeof content.role === "string"
        ? content.role
        : (process.env.NOCHESTRA_ROLE || process.env.PI_ROLE || null);

      return {
        workflow: this.name,
        taskId,
        taskPath,
        taskDir,
        role,
      };
    } catch {
      return null;
    }
  }

  attach(context: WorkflowContext, artifacts: { html: string; record: string }): void {
    if (!context.taskDir) {
      return;
    }
    appendWorkLogEntry(context.taskDir, `notrace retrospective: ${artifacts.html}`);
  }
}

export class ResearchAdapter implements WorkflowAdapter {
  name = "research";

  detect(cwd: string): boolean {
    const gitDir = path.join(cwd, ".git");
    const activeTaskPointer = path.join(cwd, POINTER_ACTIVE_TASK_LEGACY);
    return existsSync(gitDir) && !existsSync(activeTaskPointer);
  }

  getContext(cwd: string): WorkflowContext | null {
    const headFile = path.join(cwd, ".git", "HEAD");
    if (!existsSync(headFile)) {
      return null;
    }

    try {
      const head = readFileSync(headFile, "utf-8");
      const branch = head.split("refs/heads/")[1]?.trim() || "main";

      return {
        workflow: this.name,
        taskId: `branch:${branch}`,
        taskPath: null,
        taskDir: null,
        role: process.env.NOCHESTRA_ROLE || process.env.PI_ROLE || null,
      };
    } catch {
      return null;
    }
  }

  attach(): void {
    // No-op for branch research mode
  }
}

export class GenericAdapter implements WorkflowAdapter {
  name = "generic";

  detect(): boolean {
    return true;
  }

  getContext(): WorkflowContext | null {
    return null;
  }

  attach(): void {
    // No-op for generic fallback
  }
}

const ADAPTERS: WorkflowAdapter[] = [
  new ActiveWorkflowAdapter(),
  new NorpivAdapter(),
  new ResearchAdapter(),
  new GenericAdapter(),
];

export function getActiveAdapter(cwd: string): WorkflowAdapter {
  return ADAPTERS.find((adapter) => adapter.detect(cwd)) || new GenericAdapter();
}
