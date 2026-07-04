import { escapeHtml } from "../escape.js";

const TOOL_USE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`;
const TOOL_RESULT_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg>`;

function normalizeContent(value: any): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function parseMaybeJson(value: any): any {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}

function renderToolCard(label: string, icon: string, content: any, options: { headerStyle?: string; cardStyle?: string } = {}): string {
  const headerStyle = options.headerStyle ? ` style="${options.headerStyle}"` : "";
  const cardStyle = options.cardStyle ? ` style="${options.cardStyle}"` : "";
  return `<div class="chat-tool-use"${cardStyle}><div class="chat-tool-header"${headerStyle}>${icon} ${escapeHtml(label)}</div><pre class="chat-tool-body">${escapeHtml(normalizeContent(content))}</pre></div>`;
}

export function renderToolUseHtml(name: string, input: any): string {
  return renderToolCard(name, TOOL_USE_ICON, parseMaybeJson(input));
}

export function renderToolResultHtml(id: string, content: any, isError = false): string {
  return renderToolCard(`Tool Result: ${id}`, TOOL_RESULT_ICON, content, {
    headerStyle: isError ? "color: var(--err);" : "color: var(--muted);",
    cardStyle: isError ? "border-color: rgba(239,127,127,0.3);" : undefined,
  });
}

export function renderCollapsibleSection(title: string, body: string, open = false): string {
  return `<details class="panel collapsible"${open ? " open" : ""}><summary>${escapeHtml(title)}</summary><div>${body}</div></details>`;
}

export function renderKeyValueList(items: Array<[string, unknown]>): string {
  return `<div class="kv-list">${items.map(([k, v]) => `<div class="kv-row"><span class="kv-key">${escapeHtml(k)}</span><strong class="kv-value">${escapeHtml(v == null || v === "" ? "-" : v)}</strong></div>`).join("")}</div>`;
}
