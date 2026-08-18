import { describe, expect, it } from "vitest";
import { generateHtmlReport } from "../report.js";

const record = {
  traceId: "session-1",
  repository: { name: "nothing", branch: "main" },
  session: { id: "session-1", startedAt: "2026-06-17T17:00:00Z", durationMs: 15000 },
  task: { workflow: "research", id: "branch:main" },
  captureMode: "full",
  conditions: { providers: ["anthropic"] },
  activity: {
    llmCallCount: 1,
    toolCallCount: 1,
    toolErrorCount: 0,
    durationMs: 15000,
    totals: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 15, totalCostUsd: 0.01 },
  },
  telemetry: { extensions: {} },
  events: [
    { type: "llm_completion", model: "claude", provider: "anthropic", timestamp: 1710000000000, inputPayload: { messages: [{ role: "user", content: "hi" }] }, outputContent: "hello", usage: { totalTokens: 15, cost: { total: 0.01 } } },
  ],
};

describe("report-app report", () => {
  it("renders structural markers and offline CSP meta tag", () => {
    const html = generateHtmlReport(record as any);
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("Session retrospective");
    expect(html).toContain("Run Summary");
    expect(html).toContain("Timeline");
    expect(html).toContain("Branch main");
    expect(html).toContain("claude");
  });
});
