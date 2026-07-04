import { DASHBOARD_SORT_SCRIPT } from "./client.js";
import { renderDashboardBody } from "./components/dashboard.js";
import { shell } from "./shell.js";

export function generateDashboardHtml(sessions: any[], options: any = {}): string {
  return shell("notrace", renderDashboardBody(sessions, options), DASHBOARD_SORT_SCRIPT);
}
