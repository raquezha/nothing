import { describe, expect, it } from "vitest";
import { statSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.resolve(here, "../../../templates");

function sizeOf(...parts: string[]): number {
  return statSync(path.join(templatesDir, ...parts)).size;
}

describe("template storage duplication baseline", () => {
  it("shows current self-contained html is larger than the canonical json record", () => {
    const sampleJson = sizeOf("session.sample.json");
    const sampleHtml = sizeOf("session.sample.html");
    const massiveJson = sizeOf("sessions", "019ed2ee-massive", "notrace.json");
    const massiveHtml = sizeOf("sessions", "019ed2ee-massive", "notrace.html");

    expect(sampleHtml).toBeGreaterThan(sampleJson);
    expect(massiveHtml).toBeGreaterThan(massiveJson);
    expect(massiveHtml - massiveJson).toBeGreaterThan(1_000_000);
  });
});
