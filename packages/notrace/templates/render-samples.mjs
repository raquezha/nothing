import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDashboardHtml } from "../dist/notrace/report-app/dashboard-report.js";
import { generateHtmlReport } from "../dist/notrace/report-app/report.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardData = JSON.parse(readFileSync(path.join(here, "dashboard.sample.json"), "utf8"));
const sessionData = JSON.parse(readFileSync(path.join(here, "session.sample.json"), "utf8"));
const repositoryName = dashboardData.repositoryName || sessionData.repository?.name || "nothing";

function createRng(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

writeFileSync(path.join(here, "dashboard.sample.html"), generateDashboardHtml(dashboardData.sessions, { repositoryName }));
writeFileSync(path.join(here, "session.sample.html"), generateHtmlReport(sessionData));

for (const session of dashboardData.sessions) {
  const htmlPath = path.join(here, session.artifacts.html);
  const recordPath = path.join(here, session.artifacts.record);

  
  let sessionEvents = sessionData.events;
  if (session.sessionId === "019ed2ee-massive") {
    sessionEvents = [];
    let ts = 1781705100000;
    
    const random = createRng(20260703);
    // Model profiles
    const profiles = [
      { id: "claude-3-5-sonnet", provider: "anthropic", weight: 60, costPerMIn: 3.0, costPerMOut: 15.0 },
      { id: "gpt-4o", provider: "openai", weight: 30, costPerMIn: 5.0, costPerMOut: 15.0 },
      { id: "claude-3-opus", provider: "anthropic", weight: 5, costPerMIn: 15.0, costPerMOut: 75.0 },
      { id: "gemini-1.5-pro", provider: "google", weight: 5, costPerMIn: 3.5, costPerMOut: 10.5 }
    ];
    
    function pickModel() {
      const r = random() * 100;
      let sum = 0;
      for (const p of profiles) {
        sum += p.weight;
        if (r <= sum) return p;
      }
      return profiles[0];
    }

    let baseContext = 4000;
    let contextGrowth = 1.05;
    
    let totalIn = 0;
    let totalOut = 0;
    let totalCost = 0;
    let toolCalls = 0;

    for (let i = 0; i < 140; i++) {
      const model = pickModel();
      
      // Context grows naturally as session goes on, with jitter
      baseContext = Math.min(180000, baseContext * contextGrowth);
      let inputTokens = Math.floor(baseContext * (0.8 + random() * 0.4));
      let outputTokens = Math.floor(random() * 800) + 50;
      
      // Sometimes Opus reads massive contexts
      if (model.id === "claude-3-opus") inputTokens += 100000;
      // Sometimes Gemini reads huge cache
      if (model.id === "gemini-1.5-pro") inputTokens += 200000;

      let callCost = (inputTokens / 1_000_000) * model.costPerMIn + (outputTokens / 1_000_000) * model.costPerMOut;
      
      totalIn += inputTokens;
      totalOut += outputTokens;
      totalCost += callCost;

      sessionEvents.push({
        type: "llm_completion",
        model: model.id,
        provider: model.provider,
        inputPayload: { messages: [{role: "user", content: "Organic simulated context..."}] },
        outputContent: "Simulated output generation phase.",
        usage: {
          input: inputTokens,
          output: outputTokens,
          totalTokens: inputTokens + outputTokens,
          cost: { total: callCost }
        },
        timestamp: ts
      });
      
      ts += 2000 + random() * 15000; // LLM think time
      
      // Generate 0 to 12 tool calls
      const toolsToRun = Math.floor(Math.pow(random(), 1.5) * 12);
      for (let j = 0; j < toolsToRun; j++) {
        toolCalls++;
        const toolName = random() > 0.3 ? "bash" : "read_file";
        const isErr = random() > 0.92;
        
        sessionEvents.push({
          type: "tool_start",
          toolName: toolName,
          args: { param: "simulated_arg" },
          timestamp: ts
        });
        
        ts += 100 + random() * 3000; // Tool execution time
        
        sessionEvents.push({
          type: "tool_end",
          toolName: toolName,
          result: isErr ? { error: "Simulated execution error" } : { stdout: "Success", exitCode: 0 },
          isError: isErr,
          timestamp: ts
        });
        ts += 1000 + random() * 2000; // Wait before next tool
      }
    }
    
    // Update dashboard metadata to match the random generation
    session.activity.llmCallCount = 140;
    session.activity.toolCallCount = toolCalls;
    session.activity.totals.inputTokens = totalIn;
    session.activity.totals.outputTokens = totalOut;
    session.activity.totals.totalTokens = totalIn + totalOut;
    session.activity.totals.totalCostUsd = totalCost;
  }
  
  const sessionPage = {

    ...sessionData,
    traceId: session.sessionId,
    events: sessionEvents,
    session: {
      ...sessionData.session,
      id: session.sessionId,

      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMs: session.activity?.durationMs ?? sessionData.session?.durationMs ?? 0,
    },
    captureMode: session.captureMode || sessionData.captureMode,
    task: session.task || sessionData.task,
    conditions: session.conditions || sessionData.conditions,
    activity: session.activity || sessionData.activity,
    navigation: { indexHref: "../../dashboard.sample.html" },
    repository: {
      ...(sessionData.repository || {}),
      name: repositoryName,
    },
  };

  mkdirSync(path.dirname(htmlPath), { recursive: true });
  mkdirSync(path.dirname(recordPath), { recursive: true });
  writeFileSync(htmlPath, generateHtmlReport(sessionPage));
  writeFileSync(recordPath, `${JSON.stringify(sessionPage, null, 2)}\n`);
}

console.log(`Rendered sample templates in ${here}`);
