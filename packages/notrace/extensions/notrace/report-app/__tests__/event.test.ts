import { describe, expect, it } from "vitest";
import { renderEventCard } from "../components/event.js";

describe("report-app event", () => {
  it("escapes hostile content in lazy event body attributes", () => {
    const hostileEvent = {
      type: "llm_completion",
      outputContent: '<img src=x onerror=alert(1)><script>alert(1)</script>" autofocus onfocus=alert(1)',
      timestamp: 1000
    };

    const html = renderEventCard(hostileEvent);
    
    // The data-lazy-event-body attribute should contain the URI-encoded then HTML-escaped string.
    // It must NOT contain the raw dangerous strings.
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain('onerror=alert(1)');
    expect(html).toContain("data-lazy-event-body=");
    // Double check that the encoded payload still holds the data safely.
    expect(html).toContain("alert(1)"); // uri encoded form might just be alert(1) but the < > and " will be %3C %3E %22
    expect(html).toContain("%26lt%3Bscript%26gt%3Balert(1)%26lt%3B%2Fscript%26gt%3B");
  });

  it("renders worker_handoff title with target work item and destination", () => {
    const handoffEvent = {
      type: "worker_handoff",
      workItemId: "github-175",
      destination: "triage",
      timestamp: 2000,
    };

    const html = renderEventCard(handoffEvent);
    expect(html).toContain("worker_handoff (github-175 → triage)");
    expect(html).toContain("badge-epoch");
  });
});
