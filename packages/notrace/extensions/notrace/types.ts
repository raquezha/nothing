export type NotraceMetrics = {
  totalTokens: number;
  totalCost: number;
  turnCount: number;
  toolCallCount: number;
  toolErrorCount: number;
};

export type NotraceCorrelationInfo = {
  runId?: string | null;
  workItemId?: string | null;
  workerId?: string | null;
  parentSessionId?: string | null;
  sessionId?: string | null;
  epochId?: string | null;
};

export type NotraceEpochEventType =
  | "epoch_start"
  | "epoch_end"
  | "compaction_start"
  | "compaction_completion"
  | "worker_handoff";

export type NotraceEpochEvent = NotraceEvent & {
  type: NotraceEpochEventType;
  epochId?: string | null;
  workerId?: string | null;
  reason?: string | null;
  tokensBefore?: number | null;
  tokensAfter?: number | null;
};

export type WorkflowContext = {
  workflow: string;
  taskId: string | null;
  taskPath: string | null;
  taskDir: string | null;
  role?: string | null;
  correlation?: NotraceCorrelationInfo | null;
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
  branch?: string | null;
};

export type NotraceSessionInfo = {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  shutdownReason: string | null;
  role?: string | null;
};

export type NotraceTaskInfo = {
  workflow: string;
  id: string | null;
  path: string | null;
  dir: string | null;
  role?: string | null;
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

export type NotraceActivityContext = {
  activeTokens: number | null;
  peakTokens: number | null;
  contextWindow: number | null;
  messageCount: number | null;
};

export type NotraceActivity = {
  turnCount: number;
  llmCallCount: number;
  toolCallCount: number;
  toolErrorCount: number;
  durationMs: number;
  totals: NotraceActivityTotals;
  context: NotraceActivityContext;
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
  correlation?: NotraceCorrelationInfo | null;
  captureMode: NotraceCaptureMode;
  conditions: NotraceConditions;
  activity: NotraceActivity;
  telemetry: NotraceTelemetry;
  events: NotraceEvent[];
};
