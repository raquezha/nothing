import { describe, expect, it } from "vitest";
import { formatDateDay, formatMs, formatTelemetryStatus, formatTimeMinutes, formatTimeSeconds, formatTokens, formatUsd, parseDate, taskDisplay, workflowClassName, workflowDisplayName } from "../format.js";

describe("report-app format", () => {
  it("parses valid dates and rejects invalid ones", () => {
    expect(parseDate("2026-06-17T17:00:00Z")?.toISOString()).toBe("2026-06-17T17:00:00.000Z");
    expect(parseDate("nope")).toBeNull();
  });

  it("formats date and time pieces", () => {
    expect(formatDateDay("2026-06-17T17:00:00Z")).toBe("2026-06-17");
    expect(formatTimeMinutes("2026-06-17T17:00:00Z")).toMatch(/^17:00|\d{2}:\d{2}$/);
    expect(formatTimeSeconds("2026-06-17T17:00:00Z")).toMatch(/^17:00:00|\d{2}:\d{2}:\d{2}$/);
  });

  it("formats workflow labels and classes", () => {
    expect(workflowDisplayName("norpiv")).toBe("RPIV");
    expect(workflowDisplayName("research")).toBe("Research");
    expect(workflowDisplayName(undefined)).toBe("Generic");
    expect(workflowClassName("norpiv")).toBe("workflow-rpiv");
    expect(workflowClassName("research")).toBe("workflow-research");
    expect(workflowClassName(undefined)).toBe("workflow-generic");
  });

  it("preserves old taskDisplay semantics for direct and nested shapes", () => {
    expect(taskDisplay({ workflow: "research", id: "branch:main" } as any)).toBe("Branch main");
    expect(taskDisplay({ task: { workflow: "norpiv", id: "NR-101" } } as any)).toBe("NR-101");
    expect(taskDisplay({ workflow: "generic" } as any)).toBe("General session");
    expect(taskDisplay({ workflow: "weird" } as any)).toBe("No active task");
  });

  it("formats usd, tokens, durations, and telemetry status", () => {
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(1.234567)).toBe("$1.23457");
    expect(formatTokens(999)).toBe("999");
    expect(formatTokens(1500)).toBe("1.5k");
    expect(formatTokens(2_500_000)).toBe("2.50M");
    expect(formatMs(0)).toBe("-");
    expect(formatMs(15_000)).toBe("15s");
    expect(formatMs(125_000)).toBe("2m 5s");
    expect(formatMs(3_780_000)).toBe("1h 3m");
    expect(formatTelemetryStatus("active")).toBe("Active");
    expect(formatTelemetryStatus("loaded-disabled")).toBe("Loaded disabled");
    expect(formatTelemetryStatus(undefined)).toBe("Unknown");
  });
});
