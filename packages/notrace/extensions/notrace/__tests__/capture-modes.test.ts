import { describe, expect, it } from "vitest";
import { getInitialMode, sanitizeTraceValue } from "../index.js";

describe("Capture mode regression & default proof", () => {
  it("defaults to redacted mode when NOTRACE_CAPTURE is unset or invalid", () => {
    expect(getInitialMode(undefined)).toBe("redacted");
    expect(getInitialMode("")).toBe("redacted");
    expect(getInitialMode("invalid-mode")).toBe("redacted");
  });

  it("honors valid capture mode environment settings", () => {
    expect(getInitialMode("metadata")).toBe("metadata");
    expect(getInitialMode("REDACted")).toBe("redacted");
    expect(getInitialMode("FULL")).toBe("full");
  });

  it("metadata mode excludes prompt, tool, and provider bodies and opaque signatures", () => {
    const payload = {
      prompt: "System instructions and user prompt",
      tool: { name: "bash", args: { command: "echo sample" } },
      opaqueSignature: "sig_abc123_sensitive",
    };

    expect(sanitizeTraceValue(payload, "metadata")).toEqual({
      omitted: true,
      reason: "metadata-capture",
    });
  });

  it("redacted mode preserves structure while removing sensitive keys and bearer-style patterns", () => {
    const bearerVal = ["Bearer", "1234567890abcdef1234567890"].join(" ");
    const payload = {
      model: "claude-3-5-sonnet",
      authorization: bearerVal,
      apiKey: "my-key-value",
      messages: [
        { role: "user", content: `Normal text with ${bearerVal} key.` },
      ],
    };

    const sanitized = sanitizeTraceValue(payload, "redacted") as any;

    expect(sanitized.model).toBe("claude-3-5-sonnet");
    expect(sanitized.authorization).toBe("[REDACTED by notrace]");
    expect(sanitized.apiKey).toBe("[REDACTED by notrace]");
    expect(sanitized.messages[0].role).toBe("user");
    expect(sanitized.messages[0].content).toContain("[REDACTED by notrace]");
  });

  it("full mode preserves payloads unchanged", () => {
    const payload = {
      prompt: "Raw debug prompt",
      apiKey: "my-key-value",
    };

    expect(sanitizeTraceValue(payload, "full")).toEqual(payload);
  });
});
