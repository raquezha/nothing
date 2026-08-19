import { describe, expect, it } from "vitest";
import { generateHtmlReport, generateSessionSummaryHtml } from "../report.js";
import { safeHref } from "../shell.js";

const record = {
  traceId: "session-1",
  repository: { name: "nothing", branch: "main" },
  session: {
    id: "session-1",
    startedAt: "2026-06-17T17:00:00Z",
    durationMs: 15000,
  },
  task: { workflow: "research", id: "branch:main" },
  captureMode: "full",
  conditions: { providers: ["anthropic"] },
  activity: {
    llmCallCount: 1,
    toolCallCount: 1,
    toolErrorCount: 0,
    durationMs: 15000,
    totals: {
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 15,
      totalCostUsd: 0.01,
    },
  },
  telemetry: { extensions: {} },
  events: [
    {
      type: "llm_completion",
      model: "claude",
      provider: "anthropic",
      timestamp: 1710000000000,
      inputPayload: { messages: [{ role: "user", content: "hi" }] },
      outputContent: "hello",
      usage: { totalTokens: 15, cost: { total: 0.01 } },
    },
  ],
};

describe("report-app report", () => {
  it("renders structural markers and hardened CSP", () => {
    const html = generateHtmlReport({
      ...record,
      navigation: { indexHref: "javascript:alert(1)" },
    } as any);
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("script-src 'nonce-");
    expect(html).not.toContain("script-src 'unsafe-inline'");
    expect(html).not.toContain("onclick=");
    expect(html).toContain("data-back-link=\"true\" href=\"../../index.html\"");
    expect(html).toContain("Session retrospective");
    expect(html).toContain("Run Summary");
    expect(html).toContain("Timeline");
    expect(html).toContain("Branch main");
    expect(html).toContain("claude");
  });

  it("renders a compact session summary without an embedded timeline", () => {
    const html = generateSessionSummaryHtml({
      ...record,
      navigation: {
        indexHref: "../../index.html",
        recordHref: "notrace.json",
        viewerHref: "../../index.html?session=session-1",
      },
    } as any);
    expect(html).toContain("Session summary");
    expect(html).toContain("Open dashboard view");
    expect(html).toContain("Open canonical record");
    expect(html).not.toContain("Timeline");
  });

  it("allows local relative hrefs and blocks schemes", () => {
    expect(safeHref("../index.html")).toBe("../index.html");
    expect(safeHref("./session.html")).toBe("./session.html");
    expect(safeHref("sessions/a/notrace.html")).toBe("sessions/a/notrace.html");
    expect(safeHref("index.html?session=abc")).toBe("index.html?session=abc");
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref("https://example.com/x")).toBe("#");
    expect(safeHref("//example.com/x")).toBe("#");
  });
});
