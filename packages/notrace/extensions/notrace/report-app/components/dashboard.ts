import { escapeHtml } from "../escape.js";
import {
  formatDateDay,
  formatTimeMinutes,
  formatUsd,
  parseDate,
  resolveRepoName,
  taskDisplay,
  workflowClassName,
  workflowDisplayName,
} from "../format.js";
import { safeHref, wordmarkSvg } from "../shell.js";

function renderDateCell(value: string | number): string {
  const date = parseDate(value);
  if (!date) return `<span>${escapeHtml(value)}</span>`;
  return `<div class="date-cell"><strong>${escapeHtml(formatDateDay(value))}</strong><span>${escapeHtml(formatTimeMinutes(value))}</span></div>`;
}

function renderSessionRow(s: any, index: number, totalCount: number): string {
  const rowNumber = totalCount - index;
  const rawPath = s.artifacts?.html || s.artifacts?.record || "#";
  const normalizedPath = typeof rawPath === "string" ? rawPath.replace(/^(?:\.\/)?\.notrace[/\\]/, "") : "#";
  const link = safeHref(normalizedPath);

  const workflow = s.task?.workflow || "generic";
  const workflowLabel = workflowDisplayName(workflow);
  const tokens = Number(s.activity?.totals?.totalTokens || 0);
  const cost = Number(s.activity?.totals?.totalCostUsd || 0);
  const startTime = parseDate(s.startedAt)?.getTime() || 0;
  const shortId = String(s.sessionId || "").slice(0, 8);

  return `<tr data-index="${rowNumber}" data-workflow="${escapeHtml(workflowLabel)}" data-started="${startTime}" data-tokens="${tokens}" data-cost="${cost}">
  <td class="index-cell">${rowNumber}</td>
  <td>
    <a class="session-link" href="${escapeHtml(link)}">
      <strong>${escapeHtml(shortId)}</strong>
      <span class="session-sub">${escapeHtml(String(s.sessionId || ""))}</span>
    </a>
  </td>
  <td><span class="hero-pill">${escapeHtml(resolveRepoName(s))}</span></td>
  <td><span class="workflow-pill ${workflowClassName(workflow)}">${escapeHtml(workflowLabel)}</span></td>
  <td>${renderDateCell(s.startedAt)}</td>
  <td>${escapeHtml(taskDisplay(s))}</td>
  <td class="num-cell">${tokens.toLocaleString()}</td>
  <td class="num-cell">${formatUsd(cost)}</td>
</tr>`;
}

function renderSessionTable(reversed: any[]): string {
  if (!reversed.length) {
    return `<div class="empty">No sessions yet. Run Pi with notrace enabled. New reports appear here.</div>`;
  }

  const rowsHtml = reversed
    .map((s, index) => renderSessionRow(s, index, reversed.length))
    .join("\n");

  return `<table data-dashboard-table>
  <thead>
    <tr>
      <th class="col-index sortable-head">
        <button class="sort-btn" data-sort-key="index">
          <span class="sort-label">#</span>
          <span class="sort-state">↓</span>
        </button>
      </th>
      <th>Session</th>
      <th>Repository</th>
      <th class="sortable-head">
        <button class="sort-btn" data-sort-key="workflow">
          <span class="sort-label">Workflow</span>
          <span class="sort-state"></span>
        </button>
      </th>
      <th class="sortable-head">
        <button class="sort-btn" data-sort-key="started">
          <span class="sort-label">Started</span>
          <span class="sort-state"></span>
        </button>
      </th>
      <th>Task</th>
      <th class="sortable-head num-cell">
        <button class="sort-btn" data-sort-key="tokens">
          <span class="sort-label">Tokens</span>
          <span class="sort-state"></span>
        </button>
      </th>
      <th class="sortable-head num-cell">
        <button class="sort-btn" data-sort-key="cost">
          <span class="sort-label">Cost</span>
          <span class="sort-state"></span>
        </button>
      </th>
    </tr>
  </thead>
  <tbody>
${rowsHtml}
  </tbody>
</table>`;
}

function renderDashboardHero(sessionsCount: number, homeHref: string): string {
  return `<section class="hero">
  <div class="hero-split">
    <a class="brand-link" href="${escapeHtml(homeHref)}">${wordmarkSvg()}</a>
    <div class="hero-right">
      <div class="hero-session">
        <strong style="color: var(--text); font-weight: 500;">Global Index</strong>
        <span style="color: var(--muted);">Machine-wide session evidence.</span>
      </div>
      <div class="hero-meta">
        <span class="hero-pill">${sessionsCount} sessions</span>
      </div>
    </div>
  </div>
</section>`;
}

function renderDashboardMetrics(sessionsCount: number, totalTokens: number, totalCost: number): string {
  return `<div class="metrics">
  <div class="metric-card">
    <small>Sessions</small>
    <strong>${sessionsCount}</strong>
  </div>
  <div class="metric-card">
    <small>Total Tokens</small>
    <strong>${totalTokens.toLocaleString()}</strong>
  </div>
  <div class="metric-card">
    <small>Total Cost</small>
    <strong>${formatUsd(totalCost)}</strong>
  </div>
</div>`;
}

export function renderDashboardBody(sessions: any[], options: any = {}): string {
  const reversed = sessions.slice().reverse();
  const totalCost = sessions.reduce((sum, s) => sum + Number(s.activity?.totals?.totalCostUsd || 0), 0);
  const totalTokens = sessions.reduce((sum, s) => sum + Number(s.activity?.totals?.totalTokens || 0), 0);
  const homeHref = safeHref(options?.indexHref, "index.html");

  const heroHtml = renderDashboardHero(sessions.length, homeHref);
  const metricsHtml = renderDashboardMetrics(sessions.length, totalTokens, totalCost);
  const tableHtml = renderSessionTable(reversed);

  return `<div class="container">
  ${heroHtml}
  ${metricsHtml}
  <section class="panel" id="viewer-mount"></section>
  <section class="panel">
    <h2 class="section-title">Session Reports</h2>
    ${tableHtml}
  </section>
  <footer class="footer-note minimal">notrace • raquezha 2026</footer>
</div>`;
}
