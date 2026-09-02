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

  it("renders minimal and rich dashboard session rows gracefully with Phase 5 terminology", () => {
    const html = generateDashboardHtml([
      {
        sessionId: "min-session",
        startedAt: "2026-09-02T00:00:00Z",
      },
      {
        sessionId: "rich-session-123456",
        repository: { name: "custom-repo", branch: "main" },
        startedAt: "2026-09-02T01:00:00Z",
        task: { workflow: "norpiv", id: "github-212" },
        activity: { totals: { totalTokens: 1250, totalCostUsd: 0.0045 } },
        artifacts: { html: "sessions/rich-session/notrace.html" },
      },
    ]);

    expect(html).toContain("Global Index");
    expect(html).toContain("2 sessions");
    expect(html).toContain("Repository");
    expect(html).toContain("custom-repo @ main");
    expect(html).toContain("github-212");
    expect(html).toContain("1,250");
    expect(html).toContain("$0.00450");
  });
});
