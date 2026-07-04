export function groupByModel(events: any[]): Record<string, any> {
  const models: Record<string, any> = {};
  for (const ev of events) {
    if (ev.type !== "llm_completion") continue;
    const name = ev.model || "unknown";
    if (!models[name]) {
      models[name] = { count: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, cacheRead: 0, cacheWrite: 0, errors: 0 };
    }
    const m = models[name];
    m.count++;
    if (ev.usage) {
      m.inputTokens += Number(ev.usage.inputTokens || ev.usage.input || 0);
      m.outputTokens += Number(ev.usage.outputTokens || ev.usage.output || 0);
      m.totalTokens += Number(ev.usage.totalTokens || 0);
      m.cacheRead += Number(ev.usage.cacheReadTokens || ev.usage.cacheRead || 0);
      m.cacheWrite += Number(ev.usage.cacheWriteTokens || ev.usage.cacheWrite || 0);
      m.cost += Number(ev.usage.cost?.total || 0);
    }
    if (ev.errorMessage) m.errors++;
  }
  return models;
}

export function buildModelSwitches(events: any[]): any[] {
  const switches: any[] = [];
  let lastModel: string | null = null;
  let lastProvider: string | null = null;
  let lastTime: number | null = null;
  let completionIndex = 0;

  for (const ev of events) {
    if (ev.type !== "llm_completion") continue;
    completionIndex++;
    const currentModel = ev.model || "unknown";
    const currentProvider = ev.provider || "unknown";
    if (lastModel && lastModel !== currentModel) {
      switches.push({
        index: completionIndex,
        from: lastModel,
        to: currentModel,
        fromProvider: lastProvider || "unknown",
        toProvider: currentProvider,
        providerChanged: (lastProvider || "unknown") !== currentProvider,
        timestamp: ev.timestamp,
        timeDelta: lastTime ? ev.timestamp - lastTime : 0,
        cost: Number(ev.usage?.cost?.total || 0),
        tokens: Number(ev.usage?.totalTokens || 0)
      });
    }
    lastModel = currentModel;
    lastProvider = currentProvider;
    lastTime = ev.timestamp;
  }
  return switches;
}

export function buildModelSummary(events: any[]): any {
  const completions = events.filter((ev: any) => ev.type === "llm_completion");
  if (!completions.length) return null;
  const uniqueModels = new Set(completions.map((ev: any) => ev.model || "unknown"));
  return {
    firstModel: completions[0]?.model || "unknown",
    finalModel: completions[completions.length - 1]?.model || "unknown",
    switchCount: buildModelSwitches(events).length,
    uniqueModels: uniqueModels.size,
  };
}
