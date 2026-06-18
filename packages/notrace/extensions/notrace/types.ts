export type NotraceMetrics = {
  totalTokens: number;
  totalCost: number;
  turnCount: number;
  toolCallCount: number;
  toolErrorCount: number;
};

export type WorkflowContext = {
  workflow: string;
  taskId: string | null;
  taskPath: string | null;
  taskDir: string | null;
};

export type NotraceEvent = {
  type: string;
  timestamp: number;
  [key: string]: any;
};

export type NotraceLocation = {
  notraceDir: string;
  outputDir: string;
  context: WorkflowContext | null;
};

export type NotraceCaptureMode = "metadata" | "redacted" | "full";

export type NotraceHarnessInfo = {
  name: string;
  adapter: string;
  version: string | null;
};

export type NotraceRepositoryInfo = {
  name: string;
  cwd: string;
};

export type NotraceSessionInfo = {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  shutdownReason: string | null;
};

export type NotraceTaskInfo = {
  workflow: string;
  id: string | null;
  path: string | null;
  dir: string | null;
};

export type NotraceConditions = {
  harness: NotraceHarnessInfo;
  models: string[];
  providers: string[];
  extensions: string[];
};

export type NotraceActivityTotals = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  totalCostUsd: number;
};

export type NotraceActivity = {
  turnCount: number;
  llmCallCount: number;
  toolCallCount: number;
  toolErrorCount: number;
  durationMs: number;
  totals: NotraceActivityTotals;
};

export type NotraceExtensionTelemetryStatus = "absent" | "loaded-disabled" | "loaded-inactive" | "active" | "unknown";

export type NotraceExtensionTelemetry = {
  loaded: boolean;
  enabled: boolean | null;
  active: boolean | null;
  status: NotraceExtensionTelemetryStatus;
  summary: string | null;
  details: Record<string, unknown>;
};

export type NotraceTelemetry = {
  extensions: Record<string, NotraceExtensionTelemetry>;
};

export type NotraceRunRecord = {
  kind: "notrace-run";
  schemaVersion: number;
  traceId: string;
  repository: NotraceRepositoryInfo;
  session: NotraceSessionInfo;
  task: NotraceTaskInfo | null;
  captureMode: NotraceCaptureMode;
  conditions: NotraceConditions;
  activity: NotraceActivity;
  telemetry: NotraceTelemetry;
  events: NotraceEvent[];
};
