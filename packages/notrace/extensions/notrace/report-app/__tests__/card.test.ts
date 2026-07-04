import { describe, expect, it } from "vitest";
import { renderCollapsibleSection, renderKeyValueList, renderToolResultHtml, renderToolUseHtml } from "../components/card.js";

describe("report-app card", () => {
  it("renders tool use and result cards", () => {
    const useHtml = renderToolUseHtml("bash", { command: "echo hi" });
    const resultHtml = renderToolResultHtml("tool-1", { stdout: "ok" }, true);
    expect(useHtml).toContain("chat-tool-use");
    expect(useHtml).toContain("bash");
    expect(resultHtml).toContain("Tool Result: tool-1");
    expect(resultHtml).toContain("color: var(--err);");
  });

  it("escapes injected content", () => {
    const html = renderToolUseHtml("<script>alert(1)</script>", "<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("renders collapsible sections and key-value lists", () => {
    const section = renderCollapsibleSection("Models", "<div>body</div>", true);
    const kv = renderKeyValueList([["A", "B"], ["Empty", ""]]);
    expect(section).toContain("panel collapsible");
    expect(section).toContain(" open");
    expect(kv).toContain("kv-list");
    expect(kv).toContain("Empty");
    expect(kv).toContain(">-<");
  });
});
