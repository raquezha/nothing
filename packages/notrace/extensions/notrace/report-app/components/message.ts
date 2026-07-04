import { escapeHtml } from "../escape.js";
import { renderToolResultHtml, renderToolUseHtml } from "./card.js";

export function renderUniversalMessageContent(m: any): string {
  if (!m) return "";
  let html = "";

  if (typeof m.content === "string" && m.content.trim()) {
    html += `<div class="chat-text">${escapeHtml(m.content)}</div>`;
  } else if (Array.isArray(m.content)) {
    html += m.content.map((block: any) => {
      if (!block) return "";
      if (block.type === "text") return `<div class="chat-text">${escapeHtml(block.text)}</div>`;
      if (block.type === "tool_use") return renderToolUseHtml(block.name, block.input);
      if (block.type === "tool_result") return renderToolResultHtml(block.tool_use_id || "unknown", block.content);
      return `<pre class="chat-tool-body">${escapeHtml(JSON.stringify(block, null, 2))}</pre>`;
    }).join("");
  } else if (m.content && typeof m.content === "object") {
    html += `<pre class="chat-tool-body">${escapeHtml(JSON.stringify(m.content, null, 2))}</pre>`;
  }

  if (Array.isArray(m.tool_calls)) {
    html += m.tool_calls.map((tc: any) => {
      if (tc.type === "function" && tc.function) return renderToolUseHtml(tc.function.name, tc.function.arguments);
      return "";
    }).join("");
  }

  if (m.function_call) html += renderToolUseHtml(m.function_call.name, m.function_call.arguments);

  if (m.role === "tool") html = renderToolResultHtml(m.tool_call_id || m.name || "unknown", m.content);

  return html || `<div class="empty">Empty message</div>`;
}

export function renderMessages(messages: any[] | undefined): string {
  if (!messages?.length) return "";
  return `<section class="block"><h4>Input Messages</h4>${messages.map(m => `<div class="msg ${escapeHtml(m?.role || "unknown")} "><div class="msg-head"><span class="msg-role">${escapeHtml(m?.role || "unknown")}</span></div><div class="msg-content">${renderUniversalMessageContent(m)}</div></div>`).join("")}</section>`;
}
