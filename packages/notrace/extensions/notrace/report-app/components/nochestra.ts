import type { NochestraTelemetry } from "../../types.js";
import { escapeHtml } from "../escape.js";
import { formatTokens } from "../format.js";
import { safeHref } from "../shell.js";
import { renderCollapsibleSection } from "./card.js";

export function renderNochestraSection(nochestra?: NochestraTelemetry | null): string {
  if (!nochestra) return "";

  const workers = nochestra.workers || [];
  const epochs = nochestra.epochs || [];
  const remediations = nochestra.remediations || [];
  const savings = nochestra.quarantineSavings || null;

  if (!workers.length && !epochs.length && !remediations.length && !savings) {
    return "";
  }

  let savingsHtml = "";
  if (savings) {
    const parentPrompt = savings.parentPromptTokens != null ? formatTokens(savings.parentPromptTokens) : "unavailable";
    const parentCtx = savings.parentContextTokens != null ? formatTokens(savings.parentContextTokens) : "unavailable";
    const handoff = savings.boundedHandoffTokens != null ? formatTokens(savings.boundedHandoffTokens) : "unavailable";
    const savedTokens = savings.quarantineSavingsTokens != null ? formatTokens(savings.quarantineSavingsTokens) : "unavailable";
    const savedPct = savings.quarantineSavingsPercent != null ? `${savings.quarantineSavingsPercent}%` : "unavailable";

    savingsHtml = `
      <div style="display: grid; gap: 8px;">
        <h4 style="margin: 0; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Context Quarantine Savings</h4>
        <div class="tiny-breakdown" style="margin: 0;">
          <span>Parent Prompt <strong>${escapeHtml(parentPrompt)}</strong></span>
          <span>Parent Context <strong>${escapeHtml(parentCtx)}</strong></span>
          <span>Bounded Handoff <strong>${escapeHtml(handoff)}</strong></span>
          <span>Tokens Saved <strong>${escapeHtml(savedTokens)}</strong></span>
          <span>Savings Ratio <strong>${escapeHtml(savedPct)}</strong></span>
        </div>
      </div>
    `;
  }

  let workersHtml = "";
  if (workers.length) {
    workersHtml = `
      <div style="display: grid; gap: 8px;">
        <h4 style="margin: 0; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Worker Session Timeline</h4>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Route</th>
                <th>Command</th>
                <th>Model Tier</th>
                <th>Status</th>
                <th>Session / Worker ID</th>
              </tr>
            </thead>
            <tbody>
              ${workers
                .map(
                  (w) => `
                <tr>
                  <td><span class="badge badge-llm">${escapeHtml(w.role || "worker")}</span></td>
                  <td>${escapeHtml(w.route || "unavailable")}</td>
                  <td><code>${escapeHtml(w.command || "-")}</code></td>
                  <td>${escapeHtml(w.modelTier || "unavailable")}</td>
                  <td><span class="pill">${escapeHtml(w.status || "completed")}</span></td>
                  <td><span class="session-sub">${escapeHtml(w.sessionId || w.workerId || "-")}</span></td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  let epochsHtml = "";
  if (epochs.length) {
    epochsHtml = `
      <div style="display: grid; gap: 8px;">
        <h4 style="margin: 0; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Context Epoch Boundaries</h4>
        <div class="tiny-breakdown" style="margin: 0;">
          ${epochs
            .map(
              (ep) => `
            <span>Epoch <strong>${escapeHtml(ep.epochId)}</strong>${
                ep.checkpointRef
                  ? ` (<a href="${escapeHtml(safeHref(ep.checkpointRef, "#"))}" style="color: var(--primary);">checkpoint</a>)`
                  : ""
              }</span>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  let remediationsHtml = "";
  if (remediations.length) {
    remediationsHtml = `
      <div style="display: grid; gap: 8px;">
        <h4 style="margin: 0; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Remediation &amp; Blocker Events</h4>
        <div style="display: grid; gap: 6px;">
          ${remediations
            .map(
              (r) => `
            <div style="padding: 8px 12px; background: var(--bg-subtle, rgba(255,255,255,0.03)); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span class="badge ${r.type === "blocker" ? "badge-system" : "badge-tool"}">${escapeHtml(r.type)}</span>
                <span style="margin-left: 8px;">${escapeHtml(r.description)}</span>
              </div>
              <span class="pill">${escapeHtml(r.status || "recorded")}</span>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  const content = `
    <div style="padding: 18px 20px; display: grid; gap: 18px;">
      ${savingsHtml}
      ${workersHtml}
      ${epochsHtml}
      ${remediationsHtml}
    </div>
  `;

  return renderCollapsibleSection("Nochestra Workflow Evidence", content, false);
}
