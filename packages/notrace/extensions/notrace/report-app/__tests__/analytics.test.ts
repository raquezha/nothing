import { describe, expect, it } from "vitest";
import { buildModelSummary, buildModelSwitches, groupByModel } from "../analytics.js";

const events = [
  { type: "llm_completion", model: "a", provider: "x", timestamp: 1000, usage: { input: 10, output: 5, totalTokens: 15, cost: { total: 1 } } },
  { type: "llm_completion", model: "a", provider: "x", timestamp: "2026-06-17T17:00:02.000Z", usage: { input: 20, output: 10, totalTokens: 30, cost: { total: 2 } }, errorMessage: "oops" },
  { type: "llm_completion", model: "b", provider: "y", timestamp: "2026-06-17T17:00:03.000Z", usage: { input: 40, output: 20, cost: { total: 3 } } }, // missing totalTokens
];

describe("report-app analytics", () => {
  it("groups model usage and falls back when totalTokens is missing", () => {
    const grouped = groupByModel(events as any);
    expect(grouped.a.count).toBe(2);
    expect(grouped.a.inputTokens).toBe(30);
    expect(grouped.a.errors).toBe(1);
    
    // b is missing totalTokens, should fallback to input + output (40 + 20)
    expect(grouped.b.totalTokens).toBe(60);
  });

  it("tracks model switches and normalizes string timestamps", () => {
    const switches = buildModelSwitches(events as any);
    expect(switches).toHaveLength(1);
    expect(switches[0].from).toBe("a");
    expect(switches[0].to).toBe("b");
    expect(switches[0].providerChanged).toBe(true);
    
    // timestamp Delta between "2026-06-17T17:00:02.000Z" and "2026-06-17T17:00:03.000Z" is 1000ms
    expect(switches[0].timeDelta).toBe(1000);
    // falls back to input + output when totalTokens is missing
    expect(switches[0].tokens).toBe(60);
  });

  it("builds summary", () => {
    const summary = buildModelSummary(events as any);
    expect(summary.firstModel).toBe("a");
    expect(summary.finalModel).toBe("b");
    expect(summary.switchCount).toBe(1);
    expect(summary.uniqueModels).toBe(2);
  });
});
