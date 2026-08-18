import { escapeHtml } from "./escape.js";
import { STYLES } from "./styles.js";

export function wordmarkSvg(className = "wordmark"): string {
  return `<svg class="${escapeHtml(className)}" viewBox="0 0 420 138" aria-label="notrace" role="img" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fadeGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#E2754A"/><stop offset="100%" stop-color="#EDE2D2"/></linearGradient></defs><g id="trace-icon" transform="translate(1 -18) scale(0.93)"><path d="M6,50 C16,18 26,18 36,50 C46,82 54,82 60,50 C64,30 68,30 71,50" fill="none" stroke="url(#fadeGrad)" stroke-width="4" stroke-linecap="round"/><line x1="74" y1="50" x2="79" y2="50" stroke="#D9C9B5" stroke-width="4" stroke-linecap="round" stroke-opacity="0.6"/><circle cx="85" cy="50" r="2.2" fill="#D9C9B5" opacity="0.5"/><circle cx="90" cy="50" r="1.4" fill="#EDE2D2" opacity="0.32"/><circle cx="94" cy="50" r="0.9" fill="#EDE2D2" opacity="0.15"/></g><text x="0" y="114" fill="#ECE3DA" style="fill:#ECE3DA" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="96" font-weight="900" letter-spacing="-7">no</text><text x="82" y="114" fill="#d88462" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="96" font-weight="900" letter-spacing="-7">trace</text></svg>`;
}

export function faviconHref(): string {
  const svg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img"><title>notrace logo mark</title><desc>A wave that smooths into a flat line, then fades into dots — color shifts from trace orange to no cream as it dissolves.</desc><defs><linearGradient id="fadeGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#E2754A"/><stop offset="100%" stop-color="#EDE2D2"/></linearGradient></defs><g id="trace-icon"><path d="M6,50 C16,18 26,18 36,50 C46,82 54,82 60,50 C64,30 68,30 71,50" fill="none" stroke="url(#fadeGrad)" stroke-width="4" stroke-linecap="round"/><line x1="74" y1="50" x2="79" y2="50" stroke="#D9C9B5" stroke-width="4" stroke-linecap="round" stroke-opacity="0.6"/><circle cx="85" cy="50" r="2.2" fill="#D9C9B5" opacity="0.5"/><circle cx="90" cy="50" r="1.4" fill="#EDE2D2" opacity="0.32"/><circle cx="94" cy="50" r="0.9" fill="#EDE2D2" opacity="0.15"/></g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function copyButton(value: string, label: string, className = "copy-btn"): string {
  return `<button class="${escapeHtml(className)}" type="button" data-copy-value="${escapeHtml(value)}" aria-label="Copy ${escapeHtml(label)}" title="Copy ${escapeHtml(label)}"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>`;
}

export function exportButton(data: any): string {
  const payload = JSON.stringify({ kind: "notrace-export", traceId: data.traceId, repository: data.repository?.name, branch: data.repository?.branch, task: data.task, metrics: data.activity?.totals, summary: data.telemetry?.extensions?.noheadroom?.summary, events: (data.events || []).filter((e: any) => e.type === "llm_completion").map((e: any) => ({ model: e.model, input: e.inputPayload?.messages, output: e.outputContent })) });
  return `<button class="export-btn" type="button" data-copy-value="${escapeHtml(payload)}" title="Copy session data for LLM/Agent context"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>Export</span></button>`;
}

export function shell(title: string, body: string, script = ""): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:;"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><link rel="icon" href="${faviconHref()}"><style>${STYLES}</style></head><body>${body}${script ? `<script>${script}</script>` : ""}</body></html>`;
}
