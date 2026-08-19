import { describe, expect, it } from "vitest";
import { runCaptureModeBenchmark } from "../benchmark.js";

describe("Deterministic capture mode benchmark", () => {
  it("computes trace sizes for full, redacted, and metadata modes on long sessions", async () => {
    const results = await runCaptureModeBenchmark(20);

    expect(results.metadata.bytes).toBeLessThan(results.full.bytes);
    expect(results.metadata.bytes).toBeLessThan(results.redacted.bytes);

    const metadataSavingsPct = ((1 - results.metadata.bytes / results.full.bytes) * 100).toFixed(1);
    expect(Number(metadataSavingsPct)).toBeGreaterThan(80);
  });
});
