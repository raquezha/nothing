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
