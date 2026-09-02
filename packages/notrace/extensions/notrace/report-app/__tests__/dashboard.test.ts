import { describe, expect, it } from "vitest";
import { generateDashboardHtml } from "../dashboard-report.js";

describe("dashboard report", () => {
  it("prefers per-session html links over raw json records", () => {
    const html = generateDashboardHtml([
      {
        sessionId: "session-1",
        repositoryName: "nothing",
        startedAt: "2026-06-17T17:00:00Z",
        task: { workflow: "norpiv", id: "github-81" },
        activity: { totals: { totalTokens: 15, totalCostUsd: 0.01 } },
        artifacts: {
          html: "sessions/session-1/notrace.html",
          record: "sessions/session-1/notrace.json",
        },
      },
    ]);

    expect(html).toContain('href="sessions/session-1/notrace.html"');
    expect(html).not.toContain('href="sessions/session-1/notrace.json"');
    expect(html).toContain("Repository");
  });

  it("normalizes prefixed artifact links (.notrace/ and ./.notrace/)", () => {
    const html = generateDashboardHtml([
      {
        sessionId: "prefixed-session",
        startedAt: "2026-09-02T00:00:00Z",
        artifacts: { html: "./.notrace/sessions/prefixed/notrace.html" },
      },
      {
        sessionId: "fallback-record-session",
        startedAt: "2026-09-02T00:00:00Z",
        artifacts: { record: ".notrace/sessions/fallback/notrace.json" },
      },
    ]);

    expect(html).toContain('href="sessions/prefixed/notrace.html"');
    expect(html).toContain('href="sessions/fallback/notrace.json"');
  });
});
