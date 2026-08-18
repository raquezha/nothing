import { escapeHtml } from "../escape.js";
import { formatTimeSeconds } from "../format.js";
import { renderMessages, renderUniversalMessageContent } from "./message.js";

export function renderJsonBlock(title: string, value: unknown): string {
  return `<section class="block"><h4>${escapeHtml(title)}</h4><pre>${escapeHtml(typeof value === "string" ? value : JSON.stringify(value, null, 2))}</pre></section>`;
}

export function eventBadgeClass(ev: any): string {
  if (ev.type === "llm_completion") return "badge badge-llm";
  if (ev.type === "tool_start" || ev.type === "tool_end") return ev.isError ? "badge badge-error" : "badge badge-tool";
  if (ev.type === "epoch_start" || ev.type === "epoch_end" || ev.type === "compaction_start" || ev.type === "compaction_completion" || ev.type === "worker_handoff") return "badge badge-epoch";
  return "badge badge-system";
}

export function eventTitle(ev: any): string {
  if (ev.epochId) return `${ev.type} (${ev.epochId})`;
  return ev.model || ev.toolName || ev.reason || ev.type;
}

export function renderEventBody(ev: any): string {
  const sections: string[] = [];
  if (ev.type === "llm_completion") {
    sections.push(renderMessages(ev.inputPayload?.messages));
    if (ev.stopReason && ev.stopReason !== "stop" && ev.stopReason !== "toolUse") sections.push(renderJsonBlock("Stop Reason", ev.stopReason));
    if (ev.errorMessage) sections.push(renderJsonBlock("Error Message", ev.errorMessage));
    sections.push(`<section class="block"><h4>Output</h4><div class="msg-content">${renderUniversalMessageContent({ content: ev.outputContent })}</div></section>`);
    if (ev.usage) sections.push(renderJsonBlock("Usage", ev.usage));
  } else if (ev.type === "tool_start") {
    sections.push(`<section class="block"><h4>Arguments</h4><div class="msg-content"><div class="chat-tool-use"><div class="chat-tool-header"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg> Execution Input</div><pre class="chat-tool-body">${escapeHtml(typeof ev.args === 'string' ? ev.args : JSON.stringify(ev.args, null, 2))}</pre></div></div></section>`);
  } else if (ev.type === "tool_end") {
    sections.push(`<section class="block"><h4>${ev.isError ? "Error Result" : "Result"}</h4><div class="msg-content"><div class="chat-tool-use" style="${ev.isError ? 'border-color: rgba(239,127,127,0.3);' : ''}"><div class="chat-tool-header" style="${ev.isError ? 'color: var(--err);' : 'color: var(--muted);'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg> Execution Output</div><pre class="chat-tool-body">${escapeHtml(typeof ev.result === 'string' ? ev.result : JSON.stringify(ev.result, null, 2))}</pre></div></div></section>`);
  } else if (ev.type === "epoch_start" || ev.type === "epoch_end" || ev.type === "compaction_start" || ev.type === "compaction_completion" || ev.type === "worker_handoff") {
    const details: Record<string, unknown> = {};
    if (ev.epochId != null) details.epochId = ev.epochId;
    if (ev.workerId != null) details.workerId = ev.workerId;
    if (ev.reason != null) details.reason = ev.reason;
    if (ev.tokensBefore != null) details.tokensBefore = ev.tokensBefore;
    if (ev.tokensAfter != null) details.tokensAfter = ev.tokensAfter;
    sections.push(renderJsonBlock("Boundary Details", Object.keys(details).length > 0 ? details : ev));
  } else {
    sections.push(renderJsonBlock("Event", ev));
  }
  return `<div class="event-body"><div class="stack">${sections.join("")}</div></div>`;
}

export function renderEventCard(ev: any): string {
  return `<details class="event" data-lazy-event-body="${escapeHtml(encodeURIComponent(renderEventBody(ev)))}"><summary><div class="event-main"><span class="${eventBadgeClass(ev)}">${escapeHtml(ev.type)}</span><span class="event-title">${escapeHtml(eventTitle(ev))}</span></div><span class="event-time">${escapeHtml(formatTimeSeconds(ev.timestamp))}</span></summary></details>`;
}
