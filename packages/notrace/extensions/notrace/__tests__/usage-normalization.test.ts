import { describe, expect, it } from "vitest";
import { normalizeUsage } from "../index.js";

describe("normalizeUsage", () => {
  it("uses explicit totalTokens as-is", () => {
    expect(normalizeUsage({
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 30,
      cacheWriteTokens: 40,
      totalTokens: 7,
    })).toMatchObject({
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 30,
      cacheWriteTokens: 40,
      totalTokens: 7,
    });
  });

  it("sums component fields when totalTokens is missing", () => {
    expect(normalizeUsage({
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 3,
      cacheWriteTokens: 4,
    })).toMatchObject({
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 3,
      cacheWriteTokens: 4,
      totalTokens: 37,
    });
  });

  it("normalizes empty or null usage to zero", () => {
    expect(normalizeUsage({})).toMatchObject({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
    });
    expect(normalizeUsage(null)).toMatchObject({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
    });
  });

  it("supports mixed field name variants when totalTokens is absent", () => {
    expect(normalizeUsage({
      input: 5,
      outputTokens: 6,
      cacheRead: 7,
      cacheWriteTokens: 8,
    })).toMatchObject({
      inputTokens: 5,
      outputTokens: 6,
      cacheReadTokens: 7,
      cacheWriteTokens: 8,
      totalTokens: 26,
    });
  });

  it("keeps totalCostUsd normalization unchanged", () => {
    expect(normalizeUsage({
      inputTokens: 1,
      outputTokens: 2,
      cost: { total: 0.123 },
    })).toMatchObject({
      totalTokens: 3,
      totalCostUsd: 0.123,
    });
  });
});
