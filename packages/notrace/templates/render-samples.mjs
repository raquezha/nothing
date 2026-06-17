import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDashboardHtml, generateHtmlReport } from "../dist/notrace/renderer.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardData = JSON.parse(readFileSync(path.join(here, "dashboard.sample.json"), "utf8"));
const sessionData = JSON.parse(readFileSync(path.join(here, "session.sample.json"), "utf8"));
const repositoryName = dashboardData.repositoryName || sessionData.repository?.name || "nothing";

writeFileSync(path.join(here, "dashboard.sample.html"), generateDashboardHtml(dashboardData.sessions, { repositoryName }));
writeFileSync(path.join(here, "session.sample.html"), generateHtmlReport(sessionData));

for (const session of dashboardData.sessions) {
  const htmlPath = path.join(here, session.artifacts.html);
  const recordPath = path.join(here, session.artifacts.record);
  const sessionPage = {
    ...sessionData,
    traceId: session.sessionId,
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
