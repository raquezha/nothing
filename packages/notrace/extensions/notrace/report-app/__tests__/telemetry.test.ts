import { describe, expect, it } from "vitest";
import { renderExtensionCard, renderExtensionTelemetrySection } from "../components/telemetry.js";
import { generateHtmlReport, generateSessionSummaryHtml } from "../report.js";

describe("Dynamic Extension Telemetry Renderer", () => {
  it("renders generic extension card for arbitrary extension names", () => {
    const html = renderExtensionCard("custom-analytics", {
      loaded: true,
      enabled: true,
      active: true,
      status: "active",
      summary: "Custom telemetry active",
      details: {
        eventsSent: 42,
        endpoint: "https://example.com/api",
      },
    });

    expect(html).toContain("custom-analytics");
    expect(html).toContain("Active");
    expect(html).toContain("Custom telemetry active");
    expect(html).toContain("eventsSent");
    expect(html).toContain("42");
  });

  it("renders noheadroom/headroom telemetry with tokens saved, attempts, applied counts, and guard skips", () => {
    const html = renderExtensionCard("noheadroom", {
      loaded: true,
      enabled: true,
      active: true,
      status: "active",
      summary: "compressed 3 tool results; estimated ~1.2k tokens saved (-35%)",
      details: {
        attempts: 5,
        applied: 3,
        guardSkips: 2,
        tokensSaved: 1200,
      },
    });

    expect(html).toContain("noheadroom");
    expect(html).toContain("Active");
    expect(html).toContain("Optimization Tokens Saved");
    expect(html).toContain("1.2k");
    expect(html).toContain("Compression Attempts");
    expect(html).toContain("5");
    expect(html).toContain("Applied Transforms");
    expect(html).toContain("3");
    expect(html).toContain("Guard Skips");
    expect(html).toContain("2");
  });

  it("renders fallback states cleanly for absent, loaded-disabled, loaded-inactive, and blocked extensions", () => {
    const states = [
      { status: "absent", label: "Absent" },
      { status: "loaded-disabled", label: "Loaded disabled" },
      { status: "loaded-inactive", label: "Loaded inactive" },
      { status: "blocked", label: "Blocked" },
    ];

    for (const { status, label } of states) {
      const html = renderExtensionCard("test-ext", {
        loaded: false,
        status: status as any,
        summary: `Extension status: ${status}`,
      });

      expect(html).toContain("test-ext");
      expect(html).toContain(label);
      expect(html).not.toContain("NaN");
      expect(html).not.toContain("undefined");
    }
  });

  it("renders empty telemetry message when no extensions are present", () => {
    const html = renderExtensionTelemetrySection(null);
    expect(html).toContain("Dynamic Extension Telemetry");
    expect(html).toContain("No extension telemetry captured for this run.");
  });

  it("integrates extension telemetry section into full session summary report HTML", () => {
    const sampleData = {
      traceId: "test-telemetry-session",
      session: { startedAt: "2026-09-02T10:00:00Z", durationMs: 5000 },
      activity: { totals: { totalCostUsd: 0.05, totalTokens: 5000 } },
      telemetry: {
        extensions: {
          noheadroom: {
            loaded: true,
            enabled: true,
            active: true,
            status: "active",
            summary: "compressed 2 tool results",
            details: { attempts: 3, applied: 2, guardSkips: 1, tokensSaved: 850 },
          },
        },
      },
    };

    const summaryHtml = generateSessionSummaryHtml(sampleData);
    expect(summaryHtml).toContain("Dynamic Extension Telemetry");
    expect(summaryHtml).toContain("Optimization Tokens Saved");
    expect(summaryHtml).toContain("850");

    const fullHtml = generateHtmlReport(sampleData);
    expect(fullHtml).toContain("Dynamic Extension Telemetry");
    expect(fullHtml).toContain("noheadroom");
  });
});
