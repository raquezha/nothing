import { describe, expect, it } from "vitest";
import { buildModelSummary, buildModelSwitches, groupByModel } from "../analytics.js";

const events = [
  { type: "llm_completion", model: "a", provider: "x", timestamp: 1000, usage: { input: 10, output: 5, totalTokens: 15, cost: { total: 1 } } },
  { type: "llm_completion", model: "a", provider: "x", timestamp: 2000, usage: { input: 20, output: 10, totalTokens: 30, cost: { total: 2 } }, errorMessage: "oops" },
  { type: "llm_completion", model: "b", provider: "y", timestamp: 3000, usage: { input: 40, output: 20, totalTokens: 60, cost: { total: 3 } } },
];

describe("report-app analytics", () => {
  it("groups model usage", () => {
    const grouped = groupByModel(events as any);
    expect(grouped.a.count).toBe(2);
    expect(grouped.a.inputTokens).toBe(30);
    expect(grouped.a.errors).toBe(1);
    expect(grouped.b.totalTokens).toBe(60);
  });

  it("tracks model switches", () => {
    const switches = buildModelSwitches(events as any);
    expect(switches).toHaveLength(1);
    expect(switches[0].from).toBe("a");
    expect(switches[0].to).toBe("b");
    expect(switches[0].providerChanged).toBe(true);
  });

  it("builds summary", () => {
    const summary = buildModelSummary(events as any);
    expect(summary.firstModel).toBe("a");
    expect(summary.finalModel).toBe("b");
    expect(summary.switchCount).toBe(1);
    expect(summary.uniqueModels).toBe(2);
  });
});
