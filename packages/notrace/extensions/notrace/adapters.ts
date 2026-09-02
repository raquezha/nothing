import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import type { NochestraContextSavings, NochestraTelemetry, NotraceCorrelationInfo, WorkflowContext } from "./types.js";

export function extractNochestraTelemetry(content?: any): NochestraTelemetry | null {
  const envSavings: NochestraContextSavings = {};
  let hasEnvSavings = false;

  if (process.env.NOCHESTRA_PARENT_PROMPT_TOKENS) {
    envSavings.parentPromptTokens = Number(process.env.NOCHESTRA_PARENT_PROMPT_TOKENS);
    hasEnvSavings = true;
  }
  if (process.env.NOCHESTRA_PARENT_CONTEXT_TOKENS) {
    envSavings.parentContextTokens = Number(process.env.NOCHESTRA_PARENT_CONTEXT_TOKENS);
    hasEnvSavings = true;
  }
  if (process.env.NOCHESTRA_BOUNDED_HANDOFF_TOKENS) {
    envSavings.boundedHandoffTokens = Number(process.env.NOCHESTRA_BOUNDED_HANDOFF_TOKENS);
    hasEnvSavings = true;
  }
  if (process.env.NOCHESTRA_QUARANTINE_SAVINGS_TOKENS) {
    envSavings.quarantineSavingsTokens = Number(process.env.NOCHESTRA_QUARANTINE_SAVINGS_TOKENS);
    hasEnvSavings = true;
  }
  if (process.env.NOCHESTRA_QUARANTINE_SAVINGS_PERCENT) {
    envSavings.quarantineSavingsPercent = Number(process.env.NOCHESTRA_QUARANTINE_SAVINGS_PERCENT);
    hasEnvSavings = true;
  }

  const payload = content?.nochestra || content;
  const workers = payload?.workers || null;
  const epochs = payload?.epochs || null;
  const remediations = payload?.remediations || null;
  const quarantineSavings = payload?.quarantineSavings || (hasEnvSavings ? envSavings : null);

  if (!workers && !epochs && !remediations && !quarantineSavings) {
    return null;
  }

  return {
    ...(workers ? { workers } : {}),
    ...(epochs ? { epochs } : {}),
    ...(remediations ? { remediations } : {}),
    ...(quarantineSavings ? { quarantineSavings } : {}),
  };
}

export function extractCorrelation(content?: any): NotraceCorrelationInfo | null {
  const runId = process.env.NOCHESTRA_RUN_ID || content?.runId || content?.run_id || content?.correlation?.runId || null;
  const workItemId = process.env.NOCHESTRA_WORK_ITEM_ID || content?.workItemId || content?.work_item_id || content?.correlation?.workItemId || null;
  const workerId = process.env.NOCHESTRA_WORKER_ID || content?.workerId || content?.worker_id || content?.correlation?.workerId || null;
  const parentSessionId = process.env.NOCHESTRA_PARENT_SESSION_ID || content?.parentSessionId || content?.parent_session_id || content?.correlation?.parentSessionId || null;
  const sessionId = process.env.NOCHESTRA_SESSION_ID || content?.sessionId || content?.session_id || content?.correlation?.sessionId || null;
  const epochId = process.env.NOCHESTRA_EPOCH_ID || content?.epochId || content?.epoch_id || content?.correlation?.epochId || null;

  if (!runId && !workItemId && !workerId && !parentSessionId && !sessionId && !epochId) {
    return null;
  }

  const corr: NotraceCorrelationInfo = {};
  if (runId) corr.runId = String(runId);
  if (workItemId) corr.workItemId = String(workItemId);
  if (workerId) corr.workerId = String(workerId);
  if (parentSessionId) corr.parentSessionId = String(parentSessionId);
  if (sessionId) corr.sessionId = String(sessionId);
  if (epochId) corr.epochId = String(epochId);
  return corr;
}

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

      const correlation = extractCorrelation(content);

      return {
        workflow: typeof content.workflow === "string" ? content.workflow : this.name,
        taskId,
        taskPath: stateFile,
        taskDir,
        role,
        correlation,
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

      const correlation = extractCorrelation(content);

      return {
        workflow: this.name,
        taskId,
        taskPath,
        taskDir,
        role,
        correlation,
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
        correlation: extractCorrelation(),
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
    const correlation = extractCorrelation();
    if (correlation) {
      return {
        workflow: "generic",
        taskId: null,
        taskPath: null,
        taskDir: null,
        role: process.env.NOCHESTRA_ROLE || process.env.PI_ROLE || null,
        correlation,
      };
    }
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
