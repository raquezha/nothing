import { escapeHtml } from "../escape.js";
import { formatTelemetryStatus, formatTokens } from "../format.js";
import { renderCollapsibleSection } from "./card.js";

export type ExtensionTelemetryItem = {
  loaded?: boolean;
  enabled?: boolean | null;
  active?: boolean | null;
  status?: string | null;
  summary?: string | null;
  details?: Record<string, unknown>;
};

function statusBadgeClass(status?: string | null): string {
  switch (status) {
    case "active":
      return "badge-system";
    case "loaded-disabled":
    case "disabled":
      return "badge-user";
    case "loaded-inactive":
    case "inactive":
      return "badge-tool";
    case "blocked":
      return "badge-error";
    case "absent":
    default:
      return "badge-unknown";
  }
}

export function renderExtensionCard(name: string, data: ExtensionTelemetryItem): string {
  const status = data?.status || "unknown";
  const statusLabel = formatTelemetryStatus(status);
  const badgeClass = statusBadgeClass(status);
  const summary = data?.summary ?? null;
  const details = data?.details || {};

  // Special structured display for headroom / noheadroom telemetry
  if (name === "noheadroom" || name === "headroom") {
    const attempts = details.attempts ?? details.compressionAttempts ?? null;
    const applied = details.applied ?? details.appliedMessages ?? null;
    const guardSkips = details.guardSkips ?? details.skips ?? null;
    const tokensSaved = details.tokensSaved ?? details.savedTokens ?? null;

    const statsHtml = [
      tokensSaved != null ? `<span>Optimization Tokens Saved <strong>${formatTokens(Number(tokensSaved))}</strong></span>` : "",
      attempts != null ? `<span>Compression Attempts <strong>${Number(attempts)}</strong></span>` : "",
      applied != null ? `<span>Applied Transforms <strong>${Number(applied)}</strong></span>` : "",
      guardSkips != null ? `<span>Guard Skips <strong>${Number(guardSkips)}</strong></span>` : "",
    ].filter(Boolean).join("");

    return `<div class="card extension-card" style="padding: 16px; border: 1px solid var(--border); border-radius: 12px; margin-bottom: 12px; background: var(--panel-strong);"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;"><strong style="font-size: 1rem; color: var(--text);">${escapeHtml(name)}</strong><span class="badge ${badgeClass}">${escapeHtml(statusLabel)}</span></div>${summary ? `<div style="color: var(--muted); font-size: 0.9rem; margin-bottom: 10px; line-height: 1.5;">${escapeHtml(summary)}</div>` : ""}${statsHtml ? `<div class="tiny-breakdown" style="margin: 0; background: rgba(0,0,0,0.15); padding: 8px 12px; border-radius: 8px;">${statsHtml}</div>` : `<div style="color: var(--muted); font-size: 0.85rem; italic;">No optimization activity recorded.</div>`}</div>`;
  }

  // Generic extension telemetry card
  const detailKeys = Object.keys(details);
  const genericDetailsHtml = detailKeys.length
    ? `<div class="tiny-breakdown" style="margin: 0; background: rgba(0,0,0,0.15); padding: 8px 12px; border-radius: 8px;">${detailKeys.map((k) => `<span>${escapeHtml(k)} <strong>${escapeHtml(String(details[k]))}</strong></span>`).join("")}</div>`
    : "";

  return `<div class="card extension-card" style="padding: 16px; border: 1px solid var(--border); border-radius: 12px; margin-bottom: 12px; background: var(--panel-strong);"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;"><strong style="font-size: 1rem; color: var(--text);">${escapeHtml(name)}</strong><span class="badge ${badgeClass}">${escapeHtml(statusLabel)}</span></div>${summary ? `<div style="color: var(--muted); font-size: 0.9rem; margin-bottom: 10px; line-height: 1.5;">${escapeHtml(summary)}</div>` : ""}${genericDetailsHtml}</div>`;
}

export function renderExtensionTelemetrySection(telemetry?: Record<string, ExtensionTelemetryItem> | null, open = false): string {
  const extensions = Object.entries(telemetry || {});
  if (!extensions.length) {
    return renderCollapsibleSection(
      "Dynamic Extension Telemetry",
      `<div style="padding: 18px 20px;"><div class="empty" style="color: var(--muted); text-align: center;">No extension telemetry captured for this run.</div></div>`,
      open
    );
  }

  const cardsHtml = extensions.map(([name, data]) => renderExtensionCard(name, data)).join("");
  return renderCollapsibleSection(
    "Dynamic Extension Telemetry",
    `<div style="padding: 18px 20px;"><div style="font-size: 0.82rem; color: var(--muted); margin-bottom: 14px;">Optimization & extension metrics (tracked separately from consumed tokens):</div>${cardsHtml}</div>`,
    open
  );
}
