import * as path from 'node:path';
import * as fs from 'node:fs';

// Mocking parts of the extension logic
function existsSync(p) { return fs.existsSync(p); }
function readFileSync(p, e) { return fs.readFileSync(p, e); }
function writeFileSync(p, c) { console.log(`[MOCK] Writing to ${p}`); }

function safeResolveUnder(baseDir, candidate) {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, candidate);
  const relative = path.relative(base, resolved);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative)) ? resolved : null;
}

function appendWorkLogEntry(taskDir, message) {
  const workMd = path.join(taskDir, "WORK.md");
  console.log(`[MOCK] Appending to ${workMd}: ${message}`);
}

class NorpivAdapter {
  name = "norpiv";
  detect(cwd) { return existsSync(path.join(cwd, ".workflow", "active_task.json")); }
  getContext(cwd) {
    try {
      const workflowDir = path.join(cwd, ".workflow");
      const activeTaskJsonPath = path.join(workflowDir, "active_task.json");
      if (!existsSync(activeTaskJsonPath)) return null;
      const content = JSON.parse(readFileSync(activeTaskJsonPath, "utf-8"));
      
      const candidate = typeof content.taskPath === "string"
        ? safeResolveUnder(cwd, content.taskPath)
        : typeof content.active_task === "string"
          ? safeResolveUnder(workflowDir, path.join("tasks", content.active_task))
          : null;

      if (candidate) {
        return {
          workflow: this.name,
          taskId: typeof content.active_task === "string" ? content.active_task : path.basename(candidate),
          taskPath: path.relative(cwd, candidate),
          taskDir: candidate
        };
      }
    } catch (e) { }
    return null;
  }
  attach(context, artifacts) {
    if (!context.taskDir) return;
    const message = `notrace captured artifacts: ${artifacts.html}, ${artifacts.record}`;
    appendWorkLogEntry(context.taskDir, message);
  }
}

class GenericAdapter {
  name = "generic";
  detect() { return true; }
  getContext() { return null; }
  attach() { }
}

const ADAPTERS = [new NorpivAdapter(), new GenericAdapter()];
function getActiveAdapter(cwd) { return ADAPTERS.find(a => a.detect(cwd)); }

const cwd = process.cwd();
console.log(`Current Working Directory: ${cwd}`);

const adapter = getActiveAdapter(cwd);
console.log(`Detected Adapter: ${adapter.name}`);

console.log("\nTesting RPIV simulation...");
const mockRoot = path.join(cwd, "mock-rpiv");
const mockWorkflow = path.join(mockRoot, ".workflow");
const mockTaskDir = path.join(mockWorkflow, "tasks", "test-task");
fs.mkdirSync(mockTaskDir, { recursive: true });
fs.writeFileSync(path.join(mockWorkflow, "active_task.json"), JSON.stringify({ active_task: "test-task" }));

const mockAdapter = getActiveAdapter(mockRoot);
const mockContext = mockAdapter.getContext(mockRoot);
console.log(`Mock Adapter: ${mockAdapter.name}`);
console.log('Mock Context:', JSON.stringify(mockContext, null, 2));

mockAdapter.attach(mockContext, { 
    html: "../../.notrace/sessions/123/notrace.html", 
    record: "../../.notrace/sessions/123/notrace.json" 
});

// Cleanup
fs.rmSync(mockRoot, { recursive: true, force: true });
