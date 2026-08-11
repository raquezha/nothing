import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { ActiveWorkflowAdapter, NorpivAdapter, getActiveAdapter } from "../adapters.js";

describe("ActiveWorkflowAdapter", () => {
  it("detects canonical .workflow/active.json", () => {
    const temp = mkdtempSync(path.join(tmpdir(), "notrace-adapter-test-"));
    try {
      mkdirSync(path.join(temp, ".workflow"), { recursive: true });
      const activeData = {
        workflow: "rpiv",
        id: "github-96",
        taskId: "github-96",
        stateFile: ".workflow/tasks/github-96/WORK.md",
        taskPath: ".workflow/tasks/github-96",
      };
      writeFileSync(path.join(temp, ".workflow", "active.json"), JSON.stringify(activeData));

      const adapter = new ActiveWorkflowAdapter();
      expect(adapter.detect(temp)).toBe(true);

      const ctx = adapter.getContext(temp);
      expect(ctx).not.toBeNull();
      expect(ctx?.workflow).toBe("rpiv");
      expect(ctx?.taskId).toBe("github-96");
      expect(ctx?.taskPath).toBe(".workflow/tasks/github-96/WORK.md");
      expect(ctx?.taskDir).toBe(path.resolve(temp, ".workflow/tasks/github-96"));

      const activeAdapter = getActiveAdapter(temp);
      expect(activeAdapter.name).toBe("workflow");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it("detects legacy .workflow/active_workflow.json fallback", () => {
    const temp = mkdtempSync(path.join(tmpdir(), "notrace-adapter-test-"));
    try {
      mkdirSync(path.join(temp, ".workflow"), { recursive: true });
      const activeData = {
        workflow: "research",
        id: "research-topic",
        stateFile: ".workflow/research/topic/RESEARCH.md",
      };
      writeFileSync(path.join(temp, ".workflow", "active_workflow.json"), JSON.stringify(activeData));

      const adapter = new ActiveWorkflowAdapter();
      expect(adapter.detect(temp)).toBe(true);

      const ctx = adapter.getContext(temp);
      expect(ctx?.workflow).toBe("research");
      expect(ctx?.taskId).toBe("research-topic");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it("detects legacy .workflow/active_task.json when active.json is absent", () => {
    const temp = mkdtempSync(path.join(tmpdir(), "notrace-adapter-test-"));
    try {
      mkdirSync(path.join(temp, ".workflow"), { recursive: true });
      const activeData = {
        active_task: "local-smoke",
        taskPath: ".workflow/tasks/local-smoke/WORK.md",
      };
      writeFileSync(path.join(temp, ".workflow", "active_task.json"), JSON.stringify(activeData));

      const adapter = new NorpivAdapter();
      expect(adapter.detect(temp)).toBe(true);

      const ctx = adapter.getContext(temp);
      expect(ctx?.workflow).toBe("norpiv");
      expect(ctx?.taskId).toBe("local-smoke");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
